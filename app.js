import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const state = {
  documents: [],
  screening: [],
  analyses: [],
  synthesis: null,
  charts: {}
};

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','were','was','are','have','has','had','into','their','there','these','those','using','used','study','studies','research','article','paper','analysis','results','result','method','methods','data','based','between','among','through','about','also','can','may','more','most','such','within','without','not','but','all','one','two','three','been','than','then','when','where','which','what','how','why','who','will','shall','should','would','could','our','your','they','them','his','her','its','into','over','under','after','before','during','each','other','however','therefore','because','including','included','excluded',
  'bir','ve','veya','ile','için','olan','olarak','gibi','daha','çok','az','bu','şu','o','da','de','mi','mı','mu','mü','ise','her','hem','ama','ancak','fakat','çünkü','sonuç','sonuçlar','araştırma','çalışma','çalışmalar','makale','veri','analiz','yöntem','bulgu','bulgular','kapsamında','üzerine','göre','arasında','sonra','önce','içinde','dışında','tarafından','edilen','olduğu','olduğunu','olarak','ilişkin','ilgili','etme','tutma','dahil','hariç','tam','metin'
]);

const THEME_LEXICON = [
  { name: 'Araştırma deseni', terms: ['experimental','quasi experimental','randomized','qualitative','quantitative','mixed methods','survey','correlational','case study','design-based','action research','phenomenology','content analysis','systematic review','meta-analysis','deneysel','yarı deneysel','nitel','nicel','karma yöntem','tarama','korelasyonel','durum çalışması','tasarım tabanlı','eylem araştırması','sistematik derleme','meta analiz'] },
  { name: 'Katılımcılar ve bağlam', terms: ['student','students','teacher','teachers','children','adult','faculty','participant','participants','sample','school','university','classroom','learner','öğrenci','öğretmen','çocuk','yetişkin','katılımcı','örneklem','okul','üniversite','sınıf','öğrenen'] },
  { name: 'Teknoloji/araç kullanımı', terms: ['technology','digital','platform','software','application','mobile','web','robot','robotics','ai','artificial intelligence','chatbot','learning analytics','tool','teknoloji','dijital','platform','yazılım','uygulama','mobil','web','robotik','yapay zeka','öğrenme analitiği','araç'] },
  { name: 'Öğrenme çıktıları', terms: ['achievement','performance','skill','learning outcome','knowledge','conceptual','motivation','self-efficacy','attitude','engagement','başarı','performans','beceri','öğrenme çıktısı','bilgi','kavramsal','motivasyon','öz yeterlik','tutum','katılım'] },
  { name: 'Erişilebilirlik ve kapsayıcılık', terms: ['accessibility','inclusive','inclusion','disability','visual impairment','special needs','universal design','equity','erişilebilirlik','kapsayıcı','kapsayıcılık','engelli','görme yetersizliği','özel gereksinim','evrensel tasarım','eşitlik'] },
  { name: 'Sınırlılıklar', terms: ['limitation','limitations','limited','small sample','future research','bias','validity','reliability','sınırlılık','sınırlılıklar','küçük örneklem','gelecek araştırma','yanlılık','geçerlik','güvenirlik'] },
  { name: 'Uygulama/pedagoji', terms: ['intervention','instruction','teaching','pedagogy','curriculum','activity','training','workshop','lesson','uygulama','öğretim','pedagoji','müfredat','etkinlik','eğitim','atölye','ders'] },
  { name: 'Bulgular/etki', terms: ['significant','effect','impact','improved','increase','decrease','positive','negative','finding','findings','anlamlı','etki','gelişme','artış','azalma','olumlu','olumsuz','bulgu','bulgular'] }
];

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

function toast(message, type = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}

function setStep(stepId) {
  $$('.step').forEach(s => s.classList.toggle('active', s.id === stepId));
  $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.step === stepId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (stepId === 'analysis') renderCharts();
}

function setProgress(selector, current, total) {
  const wrapper = $(selector);
  const bar = wrapper.querySelector('div');
  wrapper.classList.remove('hidden');
  const pct = total ? Math.round((current / total) * 100) : 0;
  bar.style.width = `${pct}%`;
  if (current >= total) setTimeout(() => wrapper.classList.add('hidden'), 800);
}

function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalize(str = '') {
  return String(str)
    .toLocaleLowerCase('tr-TR')
    .replace(/[ı]/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str = '') {
  return normalize(str)
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function topKeywords(text = '', limit = 16) {
  const counts = new Map();
  for (const tok of tokenize(text)) counts.set(tok, (counts.get(tok) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

function keywordSet(text = '', limit = 40) {
  return new Set(topKeywords(text, limit).map(k => k.word));
}

function cleanText(s = '') {
  return String(s).replace(/\s+/g, ' ').trim();
}

function getResearchQuestions() {
  return $('#researchQuestions').value.split('\n').map(s => s.trim()).filter(Boolean);
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function truncate(str = '', max = 240) {
  const s = cleanText(str);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function splitSentences(text = '') {
  const cleaned = cleanText(text.replace(/\[PAGE \d+\]/g, ''));
  return cleaned
    .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/)
    .map(s => cleanText(s))
    .filter(s => s.length >= 45 && s.length <= 480);
}

function findPageForQuote(doc, quote) {
  if (!quote) return '';
  const idx = doc.text.indexOf(quote.slice(0, 60));
  if (idx < 0) return '';
  const before = doc.text.slice(0, idx);
  const matches = before.match(/\[PAGE (\d+)\]/g);
  if (!matches || !matches.length) return '';
  return matches[matches.length - 1].match(/\d+/)?.[0] || '';
}

async function extractPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    pages.push(`\n\n[PAGE ${pageNo}]\n${pageText}`);
  }
  const text = pages.join('\n');
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    title: inferTitleFromText(text, file.name),
    pageCount: pdf.numPages,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    text,
    createdAt: new Date().toISOString()
  };
}

function inferTitleFromText(text, fileName = '') {
  const fallback = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  const lines = String(text)
    .replace(/\[PAGE \d+\]/g, '')
    .split(/\n+/)
    .map(l => cleanText(l))
    .filter(l => l.length >= 8 && l.length <= 180);
  const bad = /^(abstract|özet|introduction|giriş|references|kaynakça|doi|issn|journal|vol\.?|issue)/i;
  const candidate = lines.find(l => !bad.test(l) && /[a-zA-ZÇĞİÖŞÜçğıöşü]/.test(l));
  return candidate || fallback || 'Başlık belirlenemedi';
}

async function handleFiles(files) {
  const list = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (!list.length) return toast('PDF dosyası seçilmedi.', 'warn');
  toast(`${list.length} PDF okunuyor...`);

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    try {
      const doc = await extractPdf(file);
      state.documents.push(doc);
      renderDocs();
      await sleep(40);
    } catch (err) {
      console.error(err);
      toast(`${file.name} okunamadı: ${err.message}`, 'error');
    }
  }
  toast('PDF metinleri çıkarıldı. Kriter önerisi oluşturabilirsiniz.');
}

function renderDocs() {
  const list = $('#docList');
  list.innerHTML = '';
  if (!state.documents.length) {
    list.innerHTML = '<div class="muted-box">Henüz PDF yüklenmedi.</div>';
    return;
  }
  const tmpl = $('#docCardTemplate');
  for (const doc of state.documents) {
    const node = tmpl.content.cloneNode(true);
    node.querySelector('.doc-title').textContent = doc.fileName;
    node.querySelector('.doc-meta').textContent = `${doc.pageCount} sayfa · ${doc.wordCount.toLocaleString('tr-TR')} kelime · ${truncate(doc.title, 90)}`;
    node.querySelector('.doc-status').textContent = doc.wordCount < 200 ? 'Metin az' : 'Hazır';
    list.appendChild(node);
  }
}

function suggestCriteriaFromDocs() {
  const combined = state.documents.map(d => `${d.title}\n${d.text.slice(0, 5000)}`).join('\n');
  const keywords = topKeywords(combined, 12).map(k => k.word).filter(w => w.length > 3);
  const commonTopic = keywords.slice(0, 5).join(', ');
  const years = state.documents.map(d => inferYear(d)).filter(Boolean);
  const minYear = years.length ? Math.min(...years.map(Number)) : '';
  const maxYear = years.length ? Math.max(...years.map(Number)) : '';

  return {
    summary: `${state.documents.length} PDF içinde en sık görülen kavramlar: ${keywords.slice(0, 8).join(', ') || 'belirlenemedi'}. ${years.length ? `Belirlenen yıl aralığı yaklaşık ${minYear}-${maxYear}.` : 'Yıl bilgisi güvenilir biçimde belirlenemedi.'}`,
    suggestedInclusion: [
      commonTopic ? `Çalışma ${commonTopic} kavramlarıyla ilişkili olmalıdır.` : 'Çalışma araştırma konusu ile doğrudan ilişkili olmalıdır.',
      'Tam metin erişilebilir olmalıdır.',
      'Yöntem, bulgu, sonuç veya tartışma bölümleri araştırma sorularına veri sağlamalıdır.',
      'Akademik yayın, tez, konferans bildirisi veya araştırma raporu niteliği taşımalıdır.'
    ],
    suggestedExclusion: [
      'Araştırma konusu ile ilgisiz çalışmalar hariç tutulacaktır.',
      'Tam metni çıkarılamayan veya metin içeriği çok sınırlı olan PDF dosyaları hariç tutulacaktır.',
      'Editöryal, haber, blog, duyuru, kitap tanıtımı veya yalnızca özet içeren kayıtlar hariç tutulacaktır.',
      'Tekrarlayan kayıtlar ya da aynı çalışmanın önceki sürümleri hariç tutulacaktır.'
    ],
    questionsToAskResearcher: [
      'Yayın yılı için alt ve üst sınır olacak mı?',
      'Yalnızca hakemli makaleler mi dahil edilecek, tez ve bildiriler de dahil mi?',
      'Hangi dildeki çalışmalar dahil edilecek?',
      'Belirsiz karar verilen çalışmalar ikinci bir kodlayıcı tarafından kontrol edilecek mi?',
      'Araştırma soruları için hangi veri alanları zorunlu kabul edilecek?'
    ],
    keywords
  };
}

function renderCriteriaSuggestions(data) {
  const box = $('#criteriaSuggestions');
  const inc = (data.suggestedInclusion || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
  const exc = (data.suggestedExclusion || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
  const qs = (data.questionsToAskResearcher || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
  const kws = (data.keywords || []).map(x => `<span class="keyword-pill">${escapeHtml(x)}</span>`).join('');
  box.innerHTML = `
    <strong>Özet:</strong> ${escapeHtml(data.summary || '')}
    ${kws ? `<p>${kws}</p>` : ''}
    <h4>Önerilen dahil etme kriterleri</h4><ul>${inc}</ul>
    <h4>Önerilen hariç tutma kriterleri</h4><ul>${exc}</ul>
    <h4>Araştırmacıya sorulacak netleştirme soruları</h4><ul>${qs}</ul>
    <button id="applyCriteria" class="secondary">Önerileri kutulara aktar</button>
  `;
  $('#applyCriteria').addEventListener('click', () => {
    $('#inclusionCriteria').value = (data.suggestedInclusion || []).join('\n');
    $('#exclusionCriteria').value = (data.suggestedExclusion || []).join('\n');
    toast('Öneriler kriter kutularına aktarıldı.');
  });
}

function inferYear(docOrText) {
  const text = typeof docOrText === 'string' ? docOrText : `${docOrText.fileName || ''} ${docOrText.title || ''} ${String(docOrText.text || '').slice(0, 4500)}`;
  const matches = String(text).match(/\b(19[8-9]\d|20[0-3]\d)\b/g) || [];
  if (!matches.length) return '';
  const freq = new Map();
  matches.forEach(y => freq.set(y, (freq.get(y) || 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0];
}

function inferDoi(text = '') {
  return String(text).match(/10\.\d{4,9}\/[\w.()/:;-]+/i)?.[0]?.replace(/[.,;)]$/, '') || '';
}

function detectDesign(text = '') {
  const n = normalize(text);
  const patterns = [
    ['Systematic review / meta-analysis', /systematic review|meta-analysis|meta analysis|sistematik derleme|meta analiz/],
    ['Design-based research', /design-based|design based|tasarim tabanli|tasarım tabanlı/],
    ['Experimental / quasi-experimental', /quasi-experimental|quasi experimental|experimental design|control group|randomized|deneysel|yari deneysel|yarı deneysel|kontrol grubu/],
    ['Mixed methods', /mixed methods|karma yontem|karma yöntem/],
    ['Qualitative', /qualitative|interview|focus group|case study|phenomenolog|nitel|gorusme|görüşme|odak grup|durum calismasi|durum çalışması/],
    ['Quantitative survey', /survey|questionnaire|scale|structural equation|regression|anova|t-test|nicel|tarama|anket|olcek|ölçek|regresyon/],
    ['Correlational / predictive', /correlation|correlational|predictive|korelasyon|yordayici|yordayıcı/],
    ['Content/document analysis', /content analysis|document analysis|thematic analysis|icerik analizi|içerik analizi|dokuman analizi|doküman analizi|tematik analiz/]
  ];
  const found = patterns.filter(([, r]) => r.test(n)).map(([label]) => label);
  return found[0] || 'Belirlenemedi';
}

function extractSample(text = '') {
  const sentences = splitSentences(text);
  const patterns = [/\b(n\s*=\s*\d{1,5})\b/i, /\b\d{1,5}\s+(students|teachers|participants|children|learners|faculty|adults)\b/i, /\b\d{1,5}\s+(öğrenci|ogretmen|öğretmen|katılımcı|çocuk|yetişkin)\b/i, /(sample|participants|katılımcılar|örneklem|orneklem)/i];
  const s = sentences.find(sentence => patterns.some(p => p.test(sentence)));
  return s ? truncate(s, 190) : 'Belirlenemedi';
}

function extractContext(text = '') {
  const sentences = splitSentences(text);
  const patterns = /(school|university|classroom|course|online|distance|primary|secondary|middle school|high school|higher education|okul|üniversite|universite|sınıf|sinif|ders|çevrim içi|uzaktan|ilkokul|ortaokul|lise|yükseköğretim|yuksekogretim)/i;
  const s = sentences.find(sentence => patterns.test(sentence));
  return s ? truncate(s, 190) : 'Belirlenemedi';
}

function extractFocus(text = '', title = '') {
  const source = `${title}. ${getSection(text, ['abstract','özet','giriş','introduction']).slice(0, 1800)}`;
  const words = topKeywords(source, 8).map(k => k.word);
  return words.length ? words.join(', ') : 'Belirlenemedi';
}

function getSection(text = '', headings = []) {
  const raw = String(text).replace(/\[PAGE \d+\]/g, '\n');
  const lower = raw.toLocaleLowerCase('tr-TR');
  for (const h of headings) {
    const idx = lower.indexOf(h.toLocaleLowerCase('tr-TR'));
    if (idx >= 0) return raw.slice(idx, idx + 2500);
  }
  return raw.slice(0, 3000);
}

function scoreSentence(sentence, queryKeywords) {
  const sTokens = new Set(tokenize(sentence));
  let score = 0;
  for (const k of queryKeywords) if (sTokens.has(k)) score += 1;
  for (const theme of THEME_LEXICON) {
    if (theme.terms.some(term => normalize(sentence).includes(normalize(term)))) score += 0.35;
  }
  return score;
}

function findRelevantSentences(text = '', query = '', limit = 3) {
  const qKeywords = [...keywordSet(query, 18)];
  const sentences = splitSentences(text);
  const scored = sentences
    .map(sentence => ({ sentence, score: scoreSentence(sentence, qKeywords) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.sentence);
  if (scored.length) return scored;
  return sentences.slice(0, limit);
}

function detectThemes(text = '', questions = []) {
  const n = normalize(text);
  const themes = [];
  for (const theme of THEME_LEXICON) {
    let frequency = 0;
    for (const term of theme.terms) {
      const t = normalize(term);
      const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'g');
      frequency += (n.match(re) || []).length;
    }
    if (frequency > 0) themes.push({ name: theme.name, frequency, evidence: theme.terms.slice(0, 5).join(', ') });
  }
  const rqKeywords = topKeywords(questions.join(' '), 8).map(k => k.word);
  for (const kw of rqKeywords) {
    const count = (n.match(new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'g')) || []).length;
    if (count > 0 && !themes.some(t => normalize(t.name) === kw)) {
      themes.push({ name: `RQ kavramı: ${kw}`, frequency: count, evidence: kw });
    }
  }
  return themes.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function screenDocument(doc, inclusionCriteria, exclusionCriteria) {
  const rqText = getResearchQuestions().join(' ');
  const inclusionKeywords = [...keywordSet(`${inclusionCriteria}\n${rqText}`, 35)];
  const textNormTokens = new Set(tokenize(`${doc.title}\n${doc.text.slice(0, 12000)}`));
  const matched = inclusionKeywords.filter(k => textNormTokens.has(k));
  const matchRatio = inclusionKeywords.length ? matched.length / inclusionKeywords.length : 0;

  const lowText = doc.wordCount < 220;
  const veryLowText = doc.wordCount < 90;
  const textSample = normalize(`${doc.title} ${doc.text.slice(0, 6000)}`);
  const exclusionLines = exclusionCriteria.split('\n').map(l => l.trim()).filter(Boolean);
  const exclusionEvidence = [];

  const documentTypeSignals = [
    ['editöryal/haber/blog sinyali', /editorial|news|blog|duyuru|haber|call for papers|announcement|book review|kitap tanitimi|kitap tanıtımı/],
    ['yalnızca özet veya metin azlığı', /abstract only|summary only|poster abstract|conference abstract|sadece ozet|sadece özet/]
  ];
  for (const [label, pattern] of documentTypeSignals) if (pattern.test(textSample)) exclusionEvidence.push(label);
  if (lowText) exclusionEvidence.push('PDF metni çok sınırlı çıkarıldı');

  const hasAcademicSignals = /(abstract|özet|method|methodology|yöntem|yontem|findings|results|bulgular|discussion|tartışma|references|kaynakça)/i.test(doc.text);
  let decision = 'Belirsiz';
  let confidence = 0.55;
  let rationale = '';

  if (veryLowText || exclusionEvidence.length >= 2) {
    decision = 'Hariç';
    confidence = veryLowText ? 0.82 : 0.72;
    rationale = `Hariç tutma sinyali güçlü: ${exclusionEvidence.join('; ')}.`;
  } else if (matchRatio >= 0.18 && hasAcademicSignals && exclusionEvidence.length === 0) {
    decision = 'Dahil';
    confidence = Math.min(0.92, 0.62 + matchRatio);
    rationale = `Dahil etme kavramlarıyla eşleşme bulundu: ${matched.slice(0, 8).join(', ')}.`;
  } else if (matchRatio >= 0.08 && hasAcademicSignals) {
    decision = 'Belirsiz';
    confidence = 0.58;
    rationale = `Kısmi eşleşme var ancak ikinci kodlayıcı kontrolü önerilir. Eşleşen kavramlar: ${matched.slice(0, 6).join(', ') || 'az'}.`;
  } else {
    decision = 'Hariç';
    confidence = 0.64;
    rationale = `Araştırma soruları/kriterlerle düşük eşleşme. Eşleşen kavramlar: ${matched.slice(0, 5).join(', ') || 'yok'}.`;
  }

  if (!hasAcademicSignals && decision === 'Dahil') {
    decision = 'Belirsiz';
    confidence = 0.56;
    rationale += ' Akademik bölüm sinyalleri net olmadığı için belirsiz kodlandı.';
  }

  return {
    id: doc.id,
    fileName: doc.fileName,
    title: doc.title,
    year: inferYear(doc),
    decision,
    confidence,
    rationale,
    needsManualReview: decision === 'Belirsiz' || confidence < 0.7,
    matchedKeywords: matched.slice(0, 20),
    exclusionEvidence,
    exclusionCriteriaChecked: exclusionLines.length
  };
}

function analyzeDocument(doc, researchQuestions) {
  const text = doc.text || '';
  const title = doc.title || doc.fileName;
  const year = inferYear(doc);
  const doi = inferDoi(text);
  const design = detectDesign(text);
  const sample = extractSample(text);
  const context = extractContext(text);
  const focus = extractFocus(text, title);
  const themes = detectThemes(text, researchQuestions);

  const rqAnswers = researchQuestions.map(question => {
    const evidence = findRelevantSentences(text, question, 3).map(sentence => ({
      quote: sentence,
      page: findPageForQuote(doc, sentence),
      relevance: 'Anahtar kavram eşleşmesi'
    }));
    const synthesis = evidence.length
      ? `${truncate(title, 80)} çalışmasında bu soru için öne çıkan kanıtlar ${evidence.map(e => `“${truncate(e.quote, 95)}”`).join('; ')} şeklindedir.`
      : `${truncate(title, 80)} çalışmasında bu araştırma sorusu için açık bir ifade otomatik olarak yakalanamadı.`;
    return { question, answer: synthesis, evidenceQuotes: evidence };
  });

  const keyQuotes = [
    ...findRelevantSentences(text, 'method methodology yöntem design participants sample', 2).map(q => ({ code: 'Yöntem/örneklem', quote: q, page: findPageForQuote(doc, q) })),
    ...findRelevantSentences(text, 'results findings conclusion discussion bulgular sonuç tartışma effect impact', 3).map(q => ({ code: 'Bulgular/sonuç', quote: q, page: findPageForQuote(doc, q) }))
  ].slice(0, 6);

  return {
    id: doc.id,
    fileName: doc.fileName,
    bibliographic: {
      title,
      authors: 'Otomatik belirlenemedi',
      year,
      journal: 'Otomatik belirlenemedi',
      doi
    },
    studyCharacteristics: {
      design,
      sample,
      participants: sample,
      context,
      interventionOrFocus: focus
    },
    extractedVariables: [
      { variable: 'Araştırma deseni', value: design, evidence: '' },
      { variable: 'Örneklem/katılımcılar', value: sample, evidence: '' },
      { variable: 'Bağlam', value: context, evidence: '' },
      { variable: 'Odak/değişkenler', value: focus, evidence: '' }
    ],
    rqAnswers,
    themes,
    keyQuotes,
    qualityNotes: buildQualityNotes(text)
  };
}

function buildQualityNotes(text = '') {
  const notes = [];
  if (!/(method|methodology|yöntem|yontem)/i.test(text)) notes.push('Yöntem bölümü otomatik olarak net yakalanamadı.');
  if (!/(result|findings|bulgular|sonuç|sonuc)/i.test(text)) notes.push('Bulgular/sonuç bölümü otomatik olarak net yakalanamadı.');
  if (!/(limitation|limitations|sınırlılık|sinirlilik)/i.test(text)) notes.push('Sınırlılık ifadesi belirgin değil.');
  return notes.join(' ');
}

function synthesizeResults() {
  const included = state.screening.filter(s => s.decision === 'Dahil').length;
  const unclear = state.screening.filter(s => s.decision === 'Belirsiz').length;
  const excluded = state.screening.filter(s => s.decision === 'Hariç').length;
  const themes = aggregateThemes();
  const researchQuestions = getResearchQuestions();

  const answersByResearchQuestion = researchQuestions.map(question => {
    const supporting = [];
    const quotes = [];
    for (const a of state.analyses) {
      const rq = a.rqAnswers.find(x => x.question === question);
      if (!rq) continue;
      supporting.push(a.bibliographic.title);
      for (const ev of rq.evidenceQuotes || []) if (ev.quote) quotes.push(ev.quote);
    }
    const topThemeNames = themes.slice(0, 4).map(x => x[0]).join(', ');
    return {
      question,
      synthesis: supporting.length
        ? `${supporting.length} çalışma bu araştırma sorusu için otomatik olarak kanıt sağlamaktadır. En sık yakalanan temalar ${topThemeNames || 'belirlenemedi'} başlıklarında toplanmaktadır. Bu sentez, metin içindeki anahtar kavram eşleşmeleri ve temsilî alıntılar temelinde ön analiz niteliğindedir.`
        : 'Bu araştırma sorusu için dahil edilen çalışmalarda otomatik olarak yeterli kanıt yakalanamadı.',
      supportingStudies: [...new Set(supporting)].slice(0, 12),
      representativeQuotes: quotes.slice(0, 5).map(q => truncate(q, 260))
    };
  });

  return {
    executiveSummary: `Toplam ${state.documents.length} PDF incelendi. Otomatik tarama sonucunda ${included} çalışma dahil, ${excluded} çalışma hariç, ${unclear} çalışma belirsiz olarak kodlandı. Analiz aşamasında ${state.analyses.length} çalışma için veri çıkarımı yapıldı. Bulgular, araştırmacı tarafından manuel kontrol edilmesi gereken ön analiz çıktılarıdır.`,
    answersByResearchQuestion,
    themeSummary: themes.slice(0, 8).map(([theme, frequency]) => ({
      theme,
      frequency,
      interpretation: `${frequency} frekansla otomatik olarak yakalandı; bu tema veri çıkarım tablosunda ve alıntılarda kontrol edilmelidir.`
    })),
    methodologicalNotes: 'Bu statik sürüm sunucu veya YZ API kullanmadan çalışır. Kararlar anahtar sözcük, bölüm başlığı, tema sözlüğü ve metin benzerliği sinyalleriyle üretilmiştir. PRISMA uyumlu nihai raporlama için çift kodlayıcı kontrolü ve manuel doğrulama önerilir.',
    limitations: 'PDF metin çıkarımı bazı taranmış/imaj PDF dosyalarında yetersiz kalabilir. OCR bulunmamaktadır. Atıf bilgileri, yazar adları ve dergi adları tüm PDF formatlarında güvenilir biçimde ayrıştırılamayabilir.'
  };
}

function decisionClass(decision) {
  if (decision === 'Dahil') return 'include';
  if (decision === 'Hariç') return 'exclude';
  return 'unclear';
}

function renderScreeningTable() {
  const tbody = $('#screeningTable tbody');
  tbody.innerHTML = '';
  if (!state.screening.length) {
    tbody.innerHTML = '<tr><td colspan="7">Henüz tarama yapılmadı.</td></tr>';
    return;
  }
  for (const row of state.screening) {
    const tr = document.createElement('tr');
    const confidence = typeof row.confidence === 'number' ? `${Math.round(row.confidence * 100)}%` : '';
    tr.innerHTML = `
      <td>${escapeHtml(row.fileName || '')}</td>
      <td>${escapeHtml(row.title || '')}</td>
      <td>${escapeHtml(row.year || '')}</td>
      <td>
        <select class="decision-select ${decisionClass(row.decision)}" data-id="${row.id}">
          ${['Dahil', 'Hariç', 'Belirsiz'].map(d => `<option value="${d}" ${row.decision === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </td>
      <td>${confidence}</td>
      <td>${escapeHtml(row.rationale || '')}</td>
      <td>${row.needsManualReview ? 'Evet' : 'Hayır'}</td>
    `;
    tbody.appendChild(tr);
  }
  $$('.decision-select').forEach(sel => sel.addEventListener('change', e => {
    const item = state.screening.find(x => x.id === e.target.dataset.id);
    if (item) {
      item.decision = e.target.value;
      item.needsManualReview = false;
      item.rationale = `${item.rationale || ''} Manuel karar güncellendi.`.trim();
    }
    e.target.className = `decision-select ${decisionClass(e.target.value)}`;
    renderCharts();
  }));
}

function renderExtractionTable() {
  const tbody = $('#extractionTable tbody');
  tbody.innerHTML = '';
  if (!state.analyses.length) {
    tbody.innerHTML = '<tr><td colspan="7">Henüz analiz yapılmadı.</td></tr>';
    return;
  }
  for (const a of state.analyses) {
    const b = a.bibliographic || {};
    const sc = a.studyCharacteristics || {};
    const themes = (a.themes || []).map(t => t.name || t.theme || '').filter(Boolean).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(b.title || a.fileName || '')}</td>
      <td>${escapeHtml(b.year || '')}</td>
      <td>${escapeHtml(sc.design || '')}</td>
      <td>${escapeHtml(sc.sample || sc.participants || '')}</td>
      <td>${escapeHtml(sc.context || '')}</td>
      <td>${escapeHtml(sc.interventionOrFocus || '')}</td>
      <td>${escapeHtml(themes)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderRqAnswers() {
  const wrap = $('#rqAnswerList');
  wrap.innerHTML = '';
  if (!state.analyses.length) {
    wrap.innerHTML = '<div class="muted-box">Henüz araştırma sorusu cevabı çıkarılmadı.</div>';
    return;
  }
  const questions = getResearchQuestions();
  for (const question of questions) {
    const div = document.createElement('div');
    div.className = 'rq-card';
    const answers = state.analyses
      .map(a => ({ title: a.bibliographic?.title || a.fileName, rq: a.rqAnswers?.find(x => x.question === question) }))
      .filter(x => x.rq);
    div.innerHTML = `<h4>${escapeHtml(question)}</h4>` + answers.slice(0, 6).map(x => `
      <p><strong>${escapeHtml(truncate(x.title, 80))}:</strong> ${escapeHtml(truncate(x.rq.answer, 320))}</p>
    `).join('');
    wrap.appendChild(div);
  }
}

function renderQuotes() {
  const wrap = $('#quoteList');
  wrap.innerHTML = '';
  const quotes = [];
  for (const a of state.analyses) {
    const title = a?.bibliographic?.title || a.fileName || '';
    for (const q of a.keyQuotes || []) quotes.push({ title, quote: q.quote, code: q.code, page: q.page });
    for (const rq of a.rqAnswers || []) {
      for (const ev of rq.evidenceQuotes || []) quotes.push({ title, quote: ev.quote, code: rq.question, page: ev.page });
    }
  }
  if (!quotes.length) {
    wrap.innerHTML = '<div class="muted-box">Henüz alıntı çıkarılmadı.</div>';
    return;
  }
  for (const q of quotes.slice(0, 60)) {
    const div = document.createElement('div');
    div.className = 'quote';
    div.innerHTML = `<blockquote>“${escapeHtml(q.quote || '')}”</blockquote><small>${escapeHtml(q.title)} · ${escapeHtml(q.code || '')} ${q.page ? `· s. ${escapeHtml(q.page)}` : ''}</small>`;
    wrap.appendChild(div);
  }
}

function aggregateDecisions() {
  const counts = { Dahil: 0, Hariç: 0, Belirsiz: 0 };
  state.screening.forEach(s => counts[s.decision] = (counts[s.decision] || 0) + 1);
  return counts;
}

function aggregateYears() {
  const map = new Map();
  for (const a of state.analyses) {
    const y = String(a?.bibliographic?.year || '').match(/\b(19[8-9]\d|20[0-3]\d)\b/)?.[1];
    if (y) map.set(y, (map.get(y) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
}

function aggregateThemes() {
  const map = new Map();
  for (const a of state.analyses) {
    for (const t of a.themes || []) {
      const name = t.name || t.theme;
      if (!name) continue;
      const f = Number(t.frequency || 1);
      map.set(name, (map.get(name) || 0) + f);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function chart(ctxId, config) {
  if (!window.Chart) return;
  if (state.charts[ctxId]) state.charts[ctxId].destroy();
  const ctx = document.getElementById(ctxId);
  state.charts[ctxId] = new Chart(ctx, config);
}

function renderCharts() {
  const decisions = aggregateDecisions();
  chart('decisionChart', {
    type: 'doughnut',
    data: { labels: Object.keys(decisions), datasets: [{ data: Object.values(decisions) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Dahil/Hariç Dağılımı' }, legend: { position: 'bottom' } } }
  });

  const years = aggregateYears();
  chart('yearChart', {
    type: 'bar',
    data: { labels: years.map(x => x[0]), datasets: [{ label: 'Çalışma sayısı', data: years.map(x => x[1]) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Yıla Göre Çalışmalar' }, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  const themes = aggregateThemes();
  chart('themeChart', {
    type: 'bar',
    data: { labels: themes.map(x => x[0]), datasets: [{ label: 'Frekans', data: themes.map(x => x[1]) }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { title: { display: true, text: 'Tema Frekansları' }, legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

function toCsv(rows) {
  return rows.map(row => row.map(cell => {
    const s = String(cell ?? '').replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(',')).join('\n');
}

function download(name, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportScreeningCsv() {
  const rows = [['fileName', 'title', 'year', 'decision', 'confidence', 'rationale', 'needsManualReview', 'matchedKeywords']];
  state.screening.forEach(s => rows.push([s.fileName, s.title, s.year, s.decision, s.confidence, s.rationale, s.needsManualReview, (s.matchedKeywords || []).join('; ')]));
  download('screening_results.csv', toCsv(rows), 'text/csv;charset=utf-8');
}

function exportExtractionCsv() {
  const rows = [['title', 'authors', 'year', 'journal', 'doi', 'design', 'sample', 'participants', 'context', 'interventionOrFocus', 'themes', 'qualityNotes']];
  state.analyses.forEach(a => {
    const b = a.bibliographic || {};
    const sc = a.studyCharacteristics || {};
    rows.push([b.title, b.authors, b.year, b.journal, b.doi, sc.design, sc.sample, sc.participants, sc.context, sc.interventionOrFocus, (a.themes || []).map(t => t.name || t.theme).join('; '), a.qualityNotes]);
  });
  download('extraction_table.csv', toCsv(rows), 'text/csv;charset=utf-8');
}

function saveProject() {
  const payload = {
    version: 'static-1.0',
    exportedAt: new Date().toISOString(),
    documents: state.documents,
    screening: state.screening,
    analyses: state.analyses,
    synthesis: state.synthesis,
    criteria: {
      inclusion: $('#inclusionCriteria').value,
      exclusion: $('#exclusionCriteria').value,
      questions: $('#researchQuestions').value
    }
  };
  download('sysreview_static_project.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

async function loadProject(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    state.documents = payload.documents || [];
    state.screening = payload.screening || [];
    state.analyses = payload.analyses || [];
    state.synthesis = payload.synthesis || null;
    if (payload.criteria) {
      $('#inclusionCriteria').value = payload.criteria.inclusion || $('#inclusionCriteria').value;
      $('#exclusionCriteria').value = payload.criteria.exclusion || $('#exclusionCriteria').value;
      $('#researchQuestions').value = payload.criteria.questions || $('#researchQuestions').value;
    }
    renderAll();
    toast('Proje JSON dosyası yüklendi.');
  } catch (err) {
    toast(`Proje yüklenemedi: ${err.message}`, 'error');
  }
}

function renderReport(data) {
  const box = $('#reportOutput');
  if (!data) {
    box.textContent = 'Henüz rapor oluşturulmadı.';
    return;
  }
  const rq = (data.answersByResearchQuestion || []).map(item => `
    <h3>${escapeHtml(item.question || '')}</h3>
    <p>${escapeHtml(item.synthesis || '')}</p>
    ${(item.supportingStudies || []).length ? `<strong>Destekleyen çalışmalar:</strong><ul>${item.supportingStudies.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
    ${(item.representativeQuotes || []).length ? `<strong>Temsilî alıntılar:</strong><ul>${item.representativeQuotes.map(s => `<li>“${escapeHtml(s)}”</li>`).join('')}</ul>` : ''}
  `).join('');
  const themes = (data.themeSummary || []).map(t => `<li><strong>${escapeHtml(t.theme || '')}</strong> (${escapeHtml(t.frequency || '')}): ${escapeHtml(t.interpretation || '')}</li>`).join('');
  box.innerHTML = `
    <h3>Yönetici özeti</h3>
    <p>${escapeHtml(data.executiveSummary || '')}</p>
    ${rq}
    ${themes ? `<h3>Tema özeti</h3><ul>${themes}</ul>` : ''}
    ${data.methodologicalNotes ? `<h3>Yöntemsel notlar</h3><p>${escapeHtml(data.methodologicalNotes)}</p>` : ''}
    ${data.limitations ? `<h3>Sınırlılıklar</h3><p>${escapeHtml(data.limitations)}</p>` : ''}
  `;
}

function buildHtmlReport() {
  const content = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Sistematik Alan Taraması Raporu</title><style>body{font-family:Arial,sans-serif;max-width:980px;margin:40px auto;line-height:1.6;color:#172033}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #dbe4f0;padding:8px;text-align:left;vertical-align:top}th{background:#f1f5f9}blockquote{border-left:4px solid #2458d3;margin:12px 0;padding:8px 12px;background:#f8fafc}pre{white-space:pre-wrap;background:#f8fafc;padding:12px;border:1px solid #dbe4f0;border-radius:8px}</style></head><body>
  <h1>Sistematik Alan Taraması Raporu</h1>
  <h2>Kriterler</h2>
  <h3>Dahil etme</h3><pre>${escapeHtml($('#inclusionCriteria').value)}</pre>
  <h3>Hariç tutma</h3><pre>${escapeHtml($('#exclusionCriteria').value)}</pre>
  <h2>Araştırma Soruları</h2><pre>${escapeHtml($('#researchQuestions').value)}</pre>
  <h2>Tarama Sonuçları</h2>${$('#screeningTable').outerHTML}
  <h2>Veri Çıkarım Tablosu</h2>${$('#extractionTable').outerHTML}
  <h2>Sentez</h2>${$('#reportOutput').innerHTML}
  </body></html>`;
  return content;
}

async function runScreening() {
  if (!state.documents.length) return toast('Önce PDF yükleyin.', 'warn');
  state.screening = [];
  renderScreeningTable();
  const inclusionCriteria = $('#inclusionCriteria').value;
  const exclusionCriteria = $('#exclusionCriteria').value;
  $('#runScreening').disabled = true;
  try {
    for (let i = 0; i < state.documents.length; i++) {
      setProgress('#screeningProgress', i, state.documents.length);
      await sleep(30);
      const result = screenDocument(state.documents[i], inclusionCriteria, exclusionCriteria);
      state.screening.push(result);
      renderScreeningTable();
    }
    setProgress('#screeningProgress', state.documents.length, state.documents.length);
    toast('Tarama tamamlandı. Kararları manuel olarak düzenleyebilirsiniz.');
  } catch (err) {
    toast(`Tarama hatası: ${err.message}`, 'error');
  } finally {
    $('#runScreening').disabled = false;
    renderCharts();
  }
}

async function runAnalysis() {
  if (!state.screening.length) return toast('Önce dahil/hariç taraması yapın.', 'warn');
  const includeUnclear = $('#includeUnclear').checked;
  const selectedIds = state.screening
    .filter(s => s.decision === 'Dahil' || (includeUnclear && s.decision === 'Belirsiz'))
    .map(s => s.id);
  const docs = state.documents.filter(d => selectedIds.includes(d.id));
  if (!docs.length) return toast('Analiz edilecek dahil/belirsiz çalışma yok.', 'warn');

  state.analyses = [];
  renderExtractionTable();
  renderRqAnswers();
  renderQuotes();
  const researchQuestions = getResearchQuestions();
  $('#runAnalysis').disabled = true;
  try {
    for (let i = 0; i < docs.length; i++) {
      setProgress('#analysisProgress', i, docs.length);
      await sleep(35);
      const result = analyzeDocument(docs[i], researchQuestions);
      state.analyses.push(result);
      renderExtractionTable();
      renderRqAnswers();
      renderQuotes();
      renderCharts();
    }
    setProgress('#analysisProgress', docs.length, docs.length);
    toast('Veri çıkarımı, alıntılar ve grafikler oluşturuldu.');
  } catch (err) {
    toast(`Analiz hatası: ${err.message}`, 'error');
  } finally {
    $('#runAnalysis').disabled = false;
  }
}

function runSynthesis() {
  if (!state.analyses.length) return toast('Önce analiz çalıştırın.', 'warn');
  $('#reportOutput').innerHTML = 'Sentez oluşturuluyor...';
  const data = synthesizeResults();
  state.synthesis = data;
  renderReport(data);
  toast('Sentez raporu oluşturuldu.');
}

function renderAll() {
  renderDocs();
  renderScreeningTable();
  renderExtractionTable();
  renderRqAnswers();
  renderQuotes();
  renderReport(state.synthesis);
  renderCharts();
}

function initEvents() {
  $$('.nav').forEach(btn => btn.addEventListener('click', () => setStep(btn.dataset.step)));
  $$('.goto').forEach(btn => btn.addEventListener('click', () => setStep(btn.dataset.stepTarget)));
  $('#goCriteria').addEventListener('click', () => setStep('criteria'));
  $('#pdfInput').addEventListener('change', e => handleFiles(e.target.files));
  $('#projectInput').addEventListener('change', e => e.target.files?.[0] && loadProject(e.target.files[0]));
  $('#saveProject').addEventListener('click', saveProject);
  $('#clearDocs').addEventListener('click', () => {
    state.documents = [];
    state.screening = [];
    state.analyses = [];
    state.synthesis = null;
    renderAll();
    toast('Liste temizlendi.');
  });

  const dropzone = $('.dropzone');
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

  $('#suggestCriteria').addEventListener('click', () => {
    if (!state.documents.length) return toast('Kriter önerisi için önce PDF yükleyin.', 'warn');
    const data = suggestCriteriaFromDocs();
    renderCriteriaSuggestions(data);
    toast('Kriter önerileri oluşturuldu.');
  });

  $('#runScreening').addEventListener('click', runScreening);
  $('#runAnalysis').addEventListener('click', runAnalysis);
  $('#runSynthesis').addEventListener('click', runSynthesis);
  $('#exportScreeningCsv').addEventListener('click', exportScreeningCsv);
  $('#exportExtractionCsv').addEventListener('click', exportExtractionCsv);
  $('#exportJson').addEventListener('click', saveProject);
  $('#downloadHtmlReport').addEventListener('click', () => download('systematic_review_report.html', buildHtmlReport(), 'text/html;charset=utf-8'));
}

initEvents();
renderAll();
