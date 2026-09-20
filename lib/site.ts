// Site-wide constants used by page <head> metadata, the LocalBusiness
// structured data (see localBusinessJsonLd below), and the sitemap/robots
// files. Kept in one place so there's a single spot to update if the
// production domain, phone, or address ever change.
//
// Note: this doesn't replace the visible address/phone/email already
// written into the Footer and the Hours & Location page — those are
// separate, customer-facing copy. Update both places if the real info
// changes.
import { HOURS } from "./store-hours";

export const SITE_URL = "https://manhattanmarketdc.com";
export const SITE_NAME = "Manhattan Market";
export const SITE_DESCRIPTION =
  "Order ahead for pickup or delivery at Manhattan Market, Woodley Park's neighborhood corner store on Connecticut Ave NW in Washington, DC. Hot food, snacks, drinks, and everyday essentials.";

export const BUSINESS = {
  telephone: "+12029864774",
  telephoneDisplay: "(202) 986-4774",
  email: "partners@manhattanmarketdc.com",
  streetAddress: "3706 Connecticut Ave NW",
  addressLocality: "Washington",
  addressRegion: "DC",
  postalCode: "20008",
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
    email: BUSINESS.email,
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
  };
}
