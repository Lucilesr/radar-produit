"""Fictional fixtures only. No live network or user data."""
import importlib.util
from pathlib import Path
import sys
import unittest

spec = importlib.util.spec_from_file_location("linkedin_pilot", Path(__file__).parents[1] / "scripts/linkedin-public-pilot.py")
pilot = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = pilot
spec.loader.exec_module(pilot)


def card(identity="123", title="Product Owner", host="fr.linkedin.com"):
    return f'''<li><div data-entity-urn="urn:li:jobPosting:{identity}">
    <a class="base-card__full-link" href="https://{host}/jobs/view/role-{identity}?trackingId=fictional"></a>
    <h3 class="base-search-card__title">{title}</h3>
    <h4 class="base-search-card__subtitle"><a>Entreprise fictive</a></h4>
    <span class="job-search-card__location">Bruxelles</span><time datetime="2026-10-19">Hier</time></div></li>'''


FRENCH = """<meta property="og:url" content="https://fr.linkedin.com/jobs/view/role-123">
<h1 class="top-card-layout__title">Product Owner</h1>
<div class="show-more-less-html__markup"><p>Vous rejoignez notre équipe produit.</p>
<p>Votre expérience permet de prioriser les missions et compétences nécessaires.</p>
<ul><li>Structurer le backlog.</li><li>Vérifier les livraisons.</li></ul></div>"""


class PilotTest(unittest.TestCase):
    def test_search_deduplicates_native_ids_and_strips_tracking(self):
        results = pilot.parse_search('<div class></div>' + card() + card(host="be.linkedin.com") + card("456", "Product Manager"))
        self.assertEqual([x["linkedinId"] for x in results], ["123", "456"])
        self.assertEqual(results[0]["detailUrl"], "https://fr.linkedin.com/jobs/view/role-123")
        self.assertEqual(results[0]["publishedAt"], "2026-10-19")

    def test_other_roles_and_untrusted_links_are_not_followed(self):
        results = pilot.parse_search(card() + card("456", "Product Designer") + card("789", host="linkedin.com.evil.test"))
        self.assertEqual(len(results), 1)
        for url in ("http://fr.linkedin.com/jobs/view/123", "https://evil.test/jobs/view/123",
                    "https://user:secret@fr.linkedin.com/jobs/view/123", "https://fr.linkedin.com:8443/jobs/view/123",
                    "https://fr.linkedin.com/in/private", "https://fr.linkedin.com/jobs/search/"):
            with self.assertRaises(pilot.Unreadable):
                pilot.linkedin_url(url, job=True)

    def test_real_description_keeps_paragraphs_and_never_infers_facts(self):
        candidate, reason = pilot.parse_detail(FRENCH, pilot.parse_search(card())[0])
        self.assertIsNone(reason)
        offer = candidate["offer"]
        self.assertIn("\nStructurer le backlog.\nVérifier les livraisons.", offer["description"])
        self.assertEqual(offer["sourceUrl"], "https://www.linkedin.com/jobs/view/123/")
        self.assertEqual(offer["contractType"], "other")
        self.assertEqual(offer["remoteMode"], "unknown")
        self.assertEqual(offer["language"], "unknown", "description language is not a work-language requirement")
        self.assertNotIn("remoteCountry", offer, "job location is not remote eligibility")
        self.assertNotIn("notificationAt", offer, "collection time is not an email date")
        self.assertEqual(candidate["location"], "Bruxelles")
        self.assertTrue(candidate["reviewRequired"])

    def test_french_keyword_is_not_proof_of_french_description(self):
        self.assertFalse(pilot.contains_french("We need a French speaker for our Product Owner role."))
        english = FRENCH.replace("Vous rejoignez notre équipe produit.", "We need a French speaker.").replace("Votre expérience permet de prioriser les missions et compétences nécessaires.", "You own the backlog.")
        candidate, reason = pilot.parse_detail(english, pilot.parse_search(card())[0])
        self.assertIsNone(candidate)
        self.assertIn("français", reason)

    def test_a_different_job_page_is_not_attributed_to_the_requested_id(self):
        with self.assertRaises(pilot.Unreadable):
            pilot.parse_detail(FRENCH.replace("role-123", "role-456"), pilot.parse_search(card())[0])

    def test_explicit_closure_and_access_challenge_are_distinct(self):
        candidate, reason = pilot.parse_detail('<span class="closed-job__flavor">No longer accepting applications</span>' + FRENCH, pilot.parse_search(card())[0])
        self.assertIsNone(candidate)
        self.assertIn("Fermeture", reason)
        with self.assertRaises(pilot.AccessBlocked):
            pilot.parse_search("<p>We need to verify that you're not a robot.</p>")
        with self.assertRaises(pilot.Unreadable):
            pilot.parse_search("<p>A new unrecognized layout</p>")

    def test_requests_are_bounded_and_a_block_stops_the_entire_run(self):
        calls = []
        def fetch(url):
            calls.append(url)
            if len(calls) == 1:
                return card("123") + card("456") + card("789")
            raise pilot.AccessBlocked("HTTP 429")
        report = pilot.collect(fetch=fetch, max_details=3)
        self.assertEqual(report["status"], "blocked")
        self.assertEqual(len(calls), 2, "no retries or later detail reads")
        self.assertEqual(report["candidates"], [])

    def test_successful_run_defers_extra_results_without_pagination(self):
        calls = []
        def fetch(url):
            calls.append(url)
            return card("123") + card("456") if len(calls) == 1 else FRENCH
        report = pilot.collect(fetch=fetch, max_details=1)
        self.assertEqual(report["status"], "complete")
        self.assertEqual(len(calls), 2)
        self.assertEqual(report["deferred"], 1)
        self.assertEqual(len(report["candidates"]), 1)
        self.assertIn("location=Worldwide", calls[0])

    def test_unavailable_page_is_not_a_closed_offer(self):
        def fetch(url):
            if "jobs-guest" in url:
                return card()
            raise pilot.Unreadable("HTTP 404")
        report = pilot.collect(fetch=fetch)
        self.assertEqual(report["status"], "incomplete")
        self.assertEqual(report["skipped"], [])

    def test_truncated_description_is_not_reported_as_complete(self):
        candidate, _ = pilot.parse_detail(FRENCH.replace("</div>", "<p>" + "texte " * 2200 + "</p></div>"), pilot.parse_search(card())[0])
        self.assertEqual(candidate["offer"]["contentCoverage"], "partial")
        self.assertEqual(len(candidate["offer"]["description"]), 12000)


if __name__ == "__main__":
    unittest.main()
