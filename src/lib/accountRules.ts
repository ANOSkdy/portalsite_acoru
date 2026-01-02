export type AccountDecisionInput = {
  vendor?: string;
  description?: string;
  memo?: string;
  items_summary?: string;
  items?: string[];
  suggested_debit_account?: string | null;
};

export type AccountRule = { account: string; patterns: RegExp[]; priority: number };

const makePattern = (keyword: string) => {
  const normalized = keyword.normalize("NFKC");
  const relaxedSpaces = normalized.replace(/\s+/g, "\\s*");
  return new RegExp(relaxedSpaces, "i");
};

export const ACCOUNT_RULES: AccountRule[] = [
  {
    account: "販売促進費",
    priority: 120,
    patterns: [makePattern("NFCタグ"), makePattern("NFC tag")],
  },
  {
    account: "車両費",
    priority: 110,
    patterns: [
      makePattern("EneJet"),
      makePattern("ENEOS"),
      makePattern("apollo station"),
      makePattern("アポロステーション"),
      makePattern("COSMO"),
      makePattern("ガソリン"),
      makePattern("レギュラー"),
      makePattern("軽油"),
      makePattern("洗車"),
      makePattern("駐車"),
      makePattern("駐車料金"),
      makePattern("パーキング"),
      makePattern("リパーク"),
      makePattern("カープレミア"),
    ],
  },
  {
    account: "旅費交通費",
    priority: 100,
    patterns: [
      makePattern("ETC"),
      makePattern("NEXCO"),
      makePattern("高速料金"),
      makePattern("通行料金"),
      makePattern("地下鉄"),
      makePattern("タクシー"),
      makePattern("Goタクシー"),
      makePattern("北都交通"),
      makePattern("レンタカー"),
      makePattern("航空券"),
      makePattern("AIRDO"),
      makePattern("エアドゥ"),
      makePattern("宿泊"),
      makePattern("ホテル"),
      makePattern("楽天トラベル"),
    ],
  },
  {
    account: "会議費",
    priority: 95,
    patterns: [
      makePattern("BizSpot"),
      makePattern("BizSPOT"),
      makePattern("アクセアカフェ"),
      makePattern("3時間パック"),
      makePattern("チェックイン利用料"),
      makePattern("カフェ利用料"),
      makePattern("コワーキング"),
      makePattern("会議室利用"),
      makePattern("打合せスペース"),
    ],
  },
  {
    account: "通信費",
    priority: 90,
    patterns: [
      makePattern("ChatGPT"),
      makePattern("OpenAI"),
      makePattern("Gemini"),
      makePattern("Google AI Pro"),
      makePattern("Google One"),
      makePattern("YouTube Premium"),
      makePattern("Youtube"),
      makePattern("YouTube"),
      makePattern("Google Play"),
      makePattern("Vercel"),
      makePattern("レンタルサーバー"),
      makePattern("ドメイン"),
      makePattern("DNS"),
      makePattern("お名前ドットコム"),
      makePattern("ヤフージャパン"),
    ],
  },
  {
    account: "接待交際費",
    priority: 80,
    patterns: [
      makePattern("LINEギフト"),
      makePattern("ラインギフト"),
      makePattern("LINEEC"),
      makePattern("LINE EC"),
      makePattern("LINE　EC"),
      makePattern("Wolt"),
      makePattern("スシロー"),
      makePattern("はま寿司"),
      makePattern("サイゼリヤ"),
      makePattern("ケンタッキー"),
      makePattern("びっくりドンキー"),
      makePattern("串鳥"),
      makePattern("しゃぶしゃぶ"),
      makePattern("東京カルビ"),
      makePattern("mister Donut"),
      makePattern("ミスド"),
      makePattern("洋菓子"),
      makePattern("たい焼き"),
      makePattern("キャラメルサンド"),
      makePattern("手土産"),
    ],
  },
  {
    account: "消耗品費",
    priority: 70,
    patterns: [
      makePattern("名刺"),
      makePattern("Canva名刺"),
      makePattern("イヤホン"),
      makePattern("WiFiルーター"),
      makePattern("ルーター"),
      makePattern("DCM"),
      makePattern("JoyfulAK"),
      makePattern("ニトリ"),
      makePattern("ユニクロ"),
      makePattern("マウス"),
      makePattern("Logitech"),
      makePattern("周辺機器"),
      makePattern("Kindle"),
    ],
  },
  {
    account: "水道光熱費",
    priority: 60,
    patterns: [
      makePattern("ソフトバンクでんき"),
      makePattern("北海道ガス"),
      makePattern("ホッカイドウガス"),
      makePattern("電気"),
      makePattern("ガス"),
      makePattern("水道"),
      makePattern("富士山の名水"),
    ],
  },
  {
    account: "新聞図書費",
    priority: 50,
    patterns: [
      makePattern("くまざわ書店"),
      makePattern("コーチャンフォー"),
      makePattern("過去問題集"),
      makePattern("児童書"),
      makePattern("決算書"),
      makePattern("書籍"),
      makePattern("本"),
      makePattern("参考書"),
    ],
  },
  {
    account: "支払手数料",
    priority: 40,
    patterns: [makePattern("切手"), makePattern("印紙"), makePattern("法務省"), makePattern("手数料")],
  },
  {
    account: "地代家賃",
    priority: 30,
    patterns: [makePattern("家賃"), makePattern("賃料"), makePattern("レンタルオフィス"), makePattern("オフィス賃貸"), makePattern("ライフカード")],
  },
  {
    account: "外注工賃費",
    priority: 20,
    patterns: [
      makePattern("ラコル"),
      makePattern("Lacrou"),
      makePattern("Lacoru"),
      makePattern("たかおさま"),
      makePattern("業務委託"),
      makePattern("外注"),
    ],
  },
];

function buildHaystack(input: AccountDecisionInput) {
  const parts = [
    input.vendor ?? "",
    input.description ?? "",
    input.memo ?? "",
    input.items_summary ?? "",
    ...(input.items ?? []),
  ];
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}

export function findAccountRuleMatch(input: AccountDecisionInput) {
  const haystack = buildHaystack(input);
  if (!haystack) return null;

  const sorted = [...ACCOUNT_RULES].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    for (const pattern of rule.patterns) {
      if (pattern.test(haystack)) {
        return { account: rule.account, pattern: pattern.source };
      }
    }
  }

  return null;
}

export function decideDebitAccount(input: AccountDecisionInput) {
  const matched = findAccountRuleMatch(input);
  if (matched) return matched.account;

  const suggested = input.suggested_debit_account?.trim();
  if (suggested) return suggested;

  return "雑費";
}
