"""Bounded, anonymous LinkedIn discovery. Emits proposals; never writes Radar.

No account, cookies, proxy, browser impersonation or automatic retry. Public
access does not grant permission for scheduled collection; see the runbook.
"""
import argparse
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

QUERY = '("Product Owner" OR "Product Manager") AND (français OR French)'
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
ROLE = re.compile(r"\bproduct\s+(?:owner|manager)\b|\b(?:responsable|gestionnaire)\s+de\s+produits?\b", re.I)


class AccessBlocked(Exception):
    pass


class Unreadable(Exception):
    pass


def linkedin_url(url, *, job=False):
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.username or parts.password
            or parts.port not in (None, 443)
            or not re.fullmatch(r"(?:www|[a-z]{2,3})\.linkedin\.com", parts.hostname or "")):
        raise Unreadable("Lien hors du périmètre LinkedIn public")
    if job and not re.fullmatch(r"/jobs/view/(?:[^/]+-)?\d+/?", parts.path):
        raise Unreadable("Lien de fiche non reconnu")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")) if job else url


class PublicRedirects(HTTPRedirectHandler):
    max_redirections = 3

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        linkedin_url(newurl)
        if re.search(r"/(?:authwall|login|checkpoint|signup)(?:/|\?|$)", newurl):
            raise AccessBlocked("Connexion ou vérification demandée")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_public(url):
    linkedin_url(url)
    try:
        # This opener has no cookie processor or authentication handler.
        with build_opener(PublicRedirects()).open(Request(url, headers={
            "User-Agent": "RadarProduit-PublicPilot/1.0",
            "Accept": "text/html",
        }), timeout=20) as response:
            linkedin_url(response.url)
            if "text/html" not in response.headers.get("Content-Type", ""):
                raise Unreadable("Format de réponse inattendu")
            raw = response.read(1_000_001)
            if len(raw) > 1_000_000:
                raise Unreadable("Page trop volumineuse")
            return raw.decode("utf-8", errors="replace")
    except HTTPError as error:
        if error.code in (401, 403, 429, 999):
            raise AccessBlocked(f"Accès limité (HTTP {error.code}) ; aucune nouvelle tentative") from None
        raise Unreadable(f"Lecture non confirmée (HTTP {error.code})") from None
    except (URLError, TimeoutError):
        raise Unreadable("Lecture réseau non confirmée") from None


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def has(self, token):
        return token in (self.attrs.get("class") or "").split()

    def text(self):
        if self.tag in ("script", "style", "noscript"):
            return ""
        value = "".join(child.text() if isinstance(child, Node) else child for child in self.children)
        return ("\n" + value + "\n") if self.tag in ("p", "div", "li", "h1", "h2", "h3", "h4", "br") else value


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def clean(text):
    return "\n".join(re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip())


def document(html):
    try:
        root = Document(html).root
        visible = clean(root.text())
    except RecursionError:
        raise Unreadable("Structure de page trop complexe") from None
    if re.search(r"verify that you.re not a robot|security verification|vérification de sécurité|résolvez le captcha", visible, re.I):
        raise AccessBlocked("Vérification anti-robot demandée")
    return root


def first_class(node, token):
    return next((child for child in node.walk() if child.has(token)), None)


def parse_search(html):
    root = document(html)
    results, seen = [], set()
    for card in root.walk():
        match = re.fullmatch(r"urn:li:jobPosting:(\d+)", card.attrs.get("data-entity-urn") or "")
        if not match or match[1] in seen:
            continue
        title, company, location, link = [first_class(card, token) for token in (
            "base-search-card__title", "base-search-card__subtitle", "job-search-card__location", "base-card__full-link")]
        if title is None or link is None or not ROLE.search(clean(title.text())):
            continue
        try:
            url = linkedin_url(link.attrs.get("href") or "", job=True)
        except (Unreadable, ValueError):
            continue
        if not re.search(r"(?:/|-)" + re.escape(match[1]) + r"/?$", urlsplit(url).path):
            continue
        date_node = next((node for node in card.walk() if node.tag == "time"), None)
        date = (date_node.attrs.get("datetime") or "") if date_node else ""
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            date = ""
        results.append({"linkedinId": match[1], "title": clean(title.text())[:180],
                        "company": clean(company.text())[:160] if company else "",
                        "location": clean(location.text()) if location else "",
                        "detailUrl": url, "publishedAt": date})
        seen.add(match[1])
    if not results and not re.search(r"no results|aucun résultat|no matching jobs", clean(root.text()), re.I):
        raise Unreadable("Résultats non reconnus ; ne pas conclure à une absence d’offres")
    return results


def contains_french(text):
    # A query mentioning French is not evidence that the advert is in French.
    markers = re.findall(r"\b(?:vous|nous|votre|notre|missions|compétences|recherché|expérience|équipe|poste|produit)\b", text.lower())
    return len(set(markers)) >= 4


def parse_detail(html, card):
    root = document(html)
    metadata = next((node for node in root.walk() if node.tag == "meta" and node.attrs.get("property") == "og:url"), None)
    if metadata is None:
        raise Unreadable("Identité de la fiche non confirmée")
    canonical = linkedin_url(metadata.attrs.get("content") or "", job=True)
    if not re.search(r"(?:/|-)" + re.escape(card["linkedinId"]) + r"/?$", urlsplit(canonical).path):
        raise Unreadable("La réponse correspond à une autre fiche")
    if first_class(root, "closed-job__flavor") is not None:
        return None, "Fermeture explicite sur la fiche"
    description = first_class(root, "show-more-less-html__markup")
    if description is None:
        raise Unreadable("Descriptif absent ou connexion demandée")
    text = clean(description.text())
    if not contains_french(text):
        return None, "Descriptif français non confirmé"
    title = first_class(root, "top-card-layout__title")
    if title is None or not ROLE.search(clean(title.text())):
        raise Unreadable("Titre de la fiche non confirmé")
    truncated = len(text) > 12000
    offer = {"title": clean(title.text())[:180], "company": card["company"],
             "contractType": "other", "remoteMode": "unknown", "language": "unknown",
             "source": "LinkedIn Jobs", "sourceUrl": f'https://www.linkedin.com/jobs/view/{card["linkedinId"]}/',
             "description": text[:12000], "contentCoverage": "partial" if truncated else "full"}
    if card["publishedAt"]:
        offer["publishedAt"] = card["publishedAt"]
    return {"linkedinId": card["linkedinId"], "location": card["location"],
            "offer": offer, "reviewRequired": True}, None


def collect(fetch=fetch_public, max_details=3):
    if not 1 <= max_details <= 5:
        raise ValueError("Le pilote vérifie entre 1 et 5 fiches par exécution")
    result = {"observedAt": datetime.now(timezone.utc).isoformat(), "query": QUERY,
              "scope": "Annonces contenant du français, tous pays ; couverture non exhaustive",
              "status": "complete", "candidates": [], "skipped": [], "requests": 0}
    try:
        url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + urlencode({
            "keywords": QUERY, "location": "Worldwide", "f_TPR": "r604800", "sortBy": "DD", "start": "0"})
        result["requests"] += 1
        cards = parse_search(fetch(url))
        result["discovered"] = len(cards)
        result["deferred"] = max(0, len(cards) - max_details)
        for card in cards[:max_details]:
            result["requests"] += 1
            candidate, reason = parse_detail(fetch(card["detailUrl"]), card)
            if candidate:
                result["candidates"].append(candidate)
            else:
                result["skipped"].append({"linkedinId": card["linkedinId"], "reason": reason})
    except AccessBlocked as error:
        result.update(status="blocked", error=str(error))
    except (Unreadable, ValueError) as error:
        result.update(status="incomplete", error=str(error))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-details", type=int, choices=range(1, 6), default=3)
    args = parser.parse_args()
    report = collect(max_details=args.max_details)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report["status"] == "complete" else 2)
