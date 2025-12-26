import type { SessionUser } from "./session";
import {
  getSiteSettings,
  listAnnouncements,
  listContacts,
  listFaqs,
  listNotifications,
  listServiceLinks,
} from "./airtable";

export async function getPortalContent(_user: SessionUser) {
  const [settings, announcements, notifications, links, contacts, faqs] =
    await Promise.all([
      getSiteSettings(),
      listAnnouncements(),
      listNotifications(),
      listServiceLinks(),
      listContacts(),
      listFaqs(),
    ]);

  const companyName =
    settings?.companyName?.trim() ||
    process.env.COMPANY_NAME ||
    "Company";

    const heroMessage = settings?.heroMessage?.trim() || "";

  const heroVideoSrc =
    settings?.heroVideoUrl?.trim() ||
    "/hero.mp4"; // public/hero.mp4 を置く or AirtableでURL指定

  return {
    companyName,
    heroMessage,
    heroVideoSrc,
    announcements,
    notifications,
    links,
    contacts,
    faqs,
  };
}
