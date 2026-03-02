/**
 * 한국(대한민국) 키워드 매칭 로직.
 * North Korea(DPRK) 오탐 방지 규칙 포함.
 */
const SelectHanguk = window.SelectHanguk || {};

SelectHanguk.DEFAULT_KEYWORDS = [
  '한국',
  '대한민국',
  'korea',
  'republic of korea',
  'south korea',
  'hanguk',
  'daehanminguk',
  'kr',
  'kor',
  'ko-kr',
  'ko_kr'
];

// 부정 키워드: 북한 제외
SelectHanguk.NEGATIVE_PATTERN = /(north korea|dprk|democratic\s*(people'?s?)?\s*republic\s*(of)?\s*korea)/i;

/**
 * 텍스트가 한국(대한민국)을 가리키는지 판별.
 * @param {string} text - 옵션 텍스트 또는 value
 * @param {string[]} [keywords] - 사용자 키워드(없으면 기본 키워드)
 * @returns {boolean}
 */
SelectHanguk.isKoreaMatch = function (text, keywords) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.trim();
  if (!normalized) return false;

  if (SelectHanguk.NEGATIVE_PATTERN.test(normalized)) return false;

  const list = keywords && keywords.length ? keywords : SelectHanguk.DEFAULT_KEYWORDS;
  const lower = normalized.toLowerCase();
  for (let i = 0; i < list.length; i++) {
    const kw = (list[i] || '').trim().toLowerCase();
    if (!kw) continue;
    const regex = new RegExp('(^|\\b)' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\b|$)', 'i');
    if (regex.test(normalized)) return true;
  }
  return false;
};

/**
 * 여러 후보 중 한국 항목 우선순위 스코어 (높을수록 우선).
 * "Republic of Korea" / "South Korea" 우선.
 */
SelectHanguk.koreaScore = function (text) {
  if (!text || typeof text !== 'string') return 0;
  const t = text.trim().toLowerCase();
  if (SelectHanguk.NEGATIVE_PATTERN.test(t)) return -1;
  if (/\brepublic of korea\b/i.test(t) || /\bsouth korea\b/i.test(t)) return 2;
  if (/\bkorea\b/i.test(t) || /한국|대한민국/.test(t) || /\bkr\b/i.test(t) || /\bkor\b/i.test(t)) return 1;
  return 0;
};
