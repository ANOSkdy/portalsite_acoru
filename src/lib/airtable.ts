const AIRTABLE_API = "https://api.airtable.com/v0";

type NextFetchInit = RequestInit & { next?: { revalidate?: number } };

type AirtableRecord<TFields> = {
  id: string;
  createdTime: string;
  fields: TFields;
};

type AirtableListResponse<TFields> = {
  records: AirtableRecord<TFields>[];
  offset?: string;
};

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BASE_ID = env("AIRTABLE_BASE_ID");
const TOKEN = env("AIRTABLE_TOKEN");

// You can use table names or table IDs. Prefer IDs for stability.
const TABLE_USERS = env("AIRTABLE_TABLE_USERS", "Users");
const TABLE_ANNOUNCEMENTS = env("AIRTABLE_TABLE_ANNOUNCEMENTS", "Announcements");
const TABLE_NOTIFICATIONS = env("AIRTABLE_TABLE_NOTIFICATIONS", "Notifications");
const TABLE_SERVICE_LINKS = env("AIRTABLE_TABLE_SERVICE_LINKS", "ServiceLinks");
const TABLE_CONTACTS = env("AIRTABLE_TABLE_CONTACTS", "Contacts");
const TABLE_FAQS = env("AIRTABLE_TABLE_FAQS", "FAQs");
const TABLE_SITE_SETTINGS = env("AIRTABLE_TABLE_SITE_SETTINGS", "SiteSettings");

function tableUrl(table: string, params?: URLSearchParams) {
  const encTable = encodeURIComponent(table);
  const base = `${AIRTABLE_API}/${BASE_ID}/${encTable}`;
  const qs = params?.toString();
  return qs ? `${base}?${qs}` : base;
}

async function airtableFetch<T>(url: string, init: NextFetchInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Airtable error ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

async function listAll<TFields>(
  table: string,
  params: URLSearchParams,
  init: NextFetchInit
): Promise<AirtableRecord<TFields>[]> {
  const out: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;

  do {
    const p = new URLSearchParams(params);
    if (offset) p.set("offset", offset);

    const url = tableUrl(table, p);
    const page = await airtableFetch<AirtableListResponse<TFields>>(url, init);

    out.push(...page.records);
    offset = page.offset;
  } while (offset);

  return out;
}

type UserFields = {
  Email?: string;
  Name?: string;
  Role?: string;
  PasswordHash?: string;
  IsActive?: boolean;
};

export async function getUserByEmail(email: string) {
  const safeEmail = email.replace(/"/g, '\\"');

  const params = new URLSearchParams();
  params.set("maxRecords", "1");
  params.set("filterByFormula", `AND({Email}="${safeEmail}", {IsActive}=TRUE())`);

  const records = await listAll<UserFields>(TABLE_USERS, params, { cache: "no-store" });
  const r = records[0];
  if (!r) return null;

  const f = r.fields;
  // Name列が無い（または空）ケースは Email を表示名に使う
  if (!f.Email || !f.PasswordHash) return null;

  return {
    id: r.id,
    email: f.Email,
    name: (f.Name && f.Name.trim()) ? f.Name : f.Email,
    role: f.Role,
    passwordHash: f.PasswordHash,
  };
}

type AnnouncementFields = {
  Title?: string;
  Body?: string;
  IsPinned?: boolean;
  IsActive?: boolean;
  PublishFrom?: string;
  PublishTo?: string;
  SortOrder?: number;
};

export async function listAnnouncements() {
  const params = new URLSearchParams();
  params.set(
    "filterByFormula",
    `AND({IsActive}=TRUE(), OR({PublishFrom}=BLANK(), {PublishFrom}<=NOW()), OR({PublishTo}=BLANK(), {PublishTo}>=NOW()))`
  );
  params.set("sort[0][field]", "IsPinned");
  params.set("sort[0][direction]", "desc");
  params.set("sort[1][field]", "SortOrder");
  params.set("sort[1][direction]", "asc");
  params.set("sort[2][field]", "PublishFrom");
  params.set("sort[2][direction]", "desc");
  params.set("maxRecords", "20");

  const records = await listAll<AnnouncementFields>(TABLE_ANNOUNCEMENTS, params, {
    next: { revalidate: 60 },
  });

  return records.map((r) => ({
    id: r.id,
    title: r.fields.Title ?? "",
    body: r.fields.Body ?? "",
    isPinned: Boolean(r.fields.IsPinned),
  })).filter((x) => x.title);
}

type NotificationFields = {
  Title?: string;
  Body?: string;
  Level?: string;
  IsActive?: boolean;
  PublishFrom?: string;
  PublishTo?: string;
  SortOrder?: number;
};

export async function listNotifications() {
  const params = new URLSearchParams();
  params.set(
    "filterByFormula",
    `AND({IsActive}=TRUE(), OR({PublishFrom}=BLANK(), {PublishFrom}<=NOW()), OR({PublishTo}=BLANK(), {PublishTo}>=NOW()))`
  );
  params.set("sort[0][field]", "SortOrder");
  params.set("sort[0][direction]", "asc");
  params.set("sort[1][field]", "PublishFrom");
  params.set("sort[1][direction]", "desc");
  params.set("maxRecords", "20");

  const records = await listAll<NotificationFields>(TABLE_NOTIFICATIONS, params, {
    next: { revalidate: 60 },
  });

  return records.map((r) => ({
    id: r.id,
    title: r.fields.Title ?? "",
    body: r.fields.Body ?? "",
    level: r.fields.Level ?? "info",
  })).filter((x) => x.title);
}

type LinkFields = {
  Name?: string;
  Url?: string;
  Description?: string;
  IsActive?: boolean;
  SortOrder?: number;
};

export async function listServiceLinks() {
  const params = new URLSearchParams();
  params.set("filterByFormula", `{IsActive}=TRUE()`);
  params.set("sort[0][field]", "SortOrder");
  params.set("sort[0][direction]", "asc");
  params.set("maxRecords", "50");

  const records = await listAll<LinkFields>(TABLE_SERVICE_LINKS, params, {
    next: { revalidate: 60 },
  });

  return records
    .map((r) => ({
      id: r.id,
      name: r.fields.Name ?? "",
      url: r.fields.Url ?? "",
      description: r.fields.Description ?? "",
    }))
    .filter((x) => x.name && x.url);
}

type ContactFields = {
  Department?: string;
  Name?: string;
  Email?: string;
  Phone?: string;
  Notes?: string;
  IsActive?: boolean;
  SortOrder?: number;
};

export async function listContacts() {
  const params = new URLSearchParams();
  params.set("filterByFormula", `{IsActive}=TRUE()`);
  params.set("sort[0][field]", "SortOrder");
  params.set("sort[0][direction]", "asc");
  params.set("maxRecords", "30");

  const records = await listAll<ContactFields>(TABLE_CONTACTS, params, {
    next: { revalidate: 60 },
  });

  return records
    .map((r) => ({
      id: r.id,
      department: r.fields.Department ?? "",
      name: r.fields.Name ?? "",
      email: r.fields.Email ?? "",
      phone: r.fields.Phone ?? "",
      notes: r.fields.Notes ?? "",
    }))
    .filter((x) => x.department);
}

type FaqFields = {
  Question?: string;
  Answer?: string;
  Category?: string;
  IsActive?: boolean;
  SortOrder?: number;
};

export async function listFaqs() {
  const params = new URLSearchParams();
  params.set("filterByFormula", `{IsActive}=TRUE()`);
  params.set("sort[0][field]", "SortOrder");
  params.set("sort[0][direction]", "asc");
  params.set("maxRecords", "30");

  const records = await listAll<FaqFields>(TABLE_FAQS, params, {
    next: { revalidate: 60 },
  });

  return records
    .map((r) => ({
      id: r.id,
      question: r.fields.Question ?? "",
      answer: r.fields.Answer ?? "",
      category: r.fields.Category ?? "",
    }))
    .filter((x) => x.question && x.answer);
}

type SiteSettingsFields = {
  CompanyName?: string;
  HeroMessage?: string;
  HeroVideoUrl?: string;
  IsActive?: boolean;
};

export async function getSiteSettings() {
  const params = new URLSearchParams();
  params.set("filterByFormula", `{IsActive}=TRUE()`);
  params.set("maxRecords", "1");

  const records = await listAll<SiteSettingsFields>(TABLE_SITE_SETTINGS, params, {
    next: { revalidate: 60 },
  });

  const r = records[0];
  if (!r) return null;

  return {
    companyName: r.fields.CompanyName ?? "",
    heroMessage: r.fields.HeroMessage ?? "",
    heroVideoUrl: r.fields.HeroVideoUrl ?? "",
  };
}
