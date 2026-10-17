// Site-wide constants used by page <head> metadata, the LocalBusiness
// structured data (see localBusinessJsonLd below), and the sitemap/robots
// files. Kept in one place so there's a single spot to update if the
// production domain, phone, or address ever change.
//
// Note: this doesn't replace the visible address/phone already
// written into the Footer and the Hours & Location page — those are
// separate, customer-facing copy. Update both places if the real info
// changes.
import { HOURS } from "./store-hours";

export const SITE_URL = "https://www.manhattanmarketdc.com";
export const SITE_NAME = "Manhattan Market";
// Nearby neighborhoods the store serves (walk-in, pickup and delivery) —
// used in the page copy and in Google's structured data.
export const NEIGHBORHOODS = ["Woodley Park", "Cleveland Park", "Adams Morgan", "Kalorama", "Mount Pleasant"];

export const SITE_DESCRIPTION =
  "Manhattan Market is Woodley Park's neighborhood convenience store at 2647 Connecticut Ave NW, Washington, DC — by the Woodley Park–Zoo Metro. Snacks, drinks, groceries and everyday essentials, open 9am–9pm daily. Order online for pickup or delivery.";

export const BUSINESS = {
  telephone: "+12029864774",
  telephoneDisplay: "(202) 986-4774",
  email: "order@manhattanmarketdc.com",
  streetAddress: "2647 Connecticut Ave NW",
  addressLocality: "Washington",
  addressRegion: "DC",
  postalCode: "20008",
  instagram: "https://www.instagram.com/manhattanmarketdc",
  facebook: "https://www.facebook.com/manhattan.market.2025",
  addressCountry: "US",
};

// Schema.org structured data (JSON-LD) describing the store itself —
// separate from any one page's content. Rendered once, site-wide, in the
// root layout. This is what lets Google show hours/address/phone directly
// in search results and improves local-pack ranking. Hours are pulled live
// from lib/store-hours.ts, so updating that file (once the real schedule is
// confirmed) automatically updates this too.
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ConvenienceStore",
    name: SITE_NAME,
    url: SITE_URL,
    telephone: BUSINESS.telephone,
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.streetAddress,
      addressLocality: BUSINESS.addressLocality,
      addressRegion: BUSINESS.addressRegion,
      postalCode: BUSINESS.postalCode,
      addressCountry: BUSINESS.addressCountry,
    },
    openingHoursSpecification: HOURS.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.open,
      closes: h.close,
    })),
    priceRange: "$",
    image: `${SITE_URL}/opengraph-image`,
    logo: `${SITE_URL}/icon`,
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${SITE_NAME}, ${BUSINESS.streetAddress}, ${BUSINESS.addressLocality}, ${BUSINESS.addressRegion} ${BUSINESS.postalCode}`
    )}`,
    areaServed: NEIGHBORHOODS.map((name) => ({ "@type": "Place", name: `${name}, Washington, DC` })),
    paymentAccepted: "Cash, Credit Card, Debit Card, Apple Pay, Google Pay",
    currenciesAccepted: "USD",
    potentialAction: {
      "@type": "OrderAction",
      target: `${SITE_URL}/order`,
      deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModePickUp", "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"],
    },
    // The store's own social pages (confirmed by the owner) — helps Google
    // connect them to this business.
    sameAs: [BUSINESS.instagram, BUSINESS.facebook],
  };
}
