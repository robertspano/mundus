// Vercel serverless function: tekur við hljóðupptöku og skilar texta.
// Notar OpenAI Whisper (styður íslensku). Lykillinn er geymdur sem
// umhverfisbreyta OPENAI_API_KEY í Vercel (aldrei í kóðanum).
//
// Frontendið (radd.html) sendir hrátt hljóð (audio/wav úr AudioContext) með POST.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Aðeins POST' });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Umritun ekki tilbúin: vantar OPENAI_API_KEY í Vercel.' });
    return;
  }

  try {
    // lesa hrátt hljóð úr beiðninni
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const audio = Buffer.concat(chunks);
    if (!audio.length) {
      res.status(400).json({ error: 'Engin hljóðgögn bárust.' });
      return;
    }
    if (audio.length > 4.5e6) {
      res.status(413).json({ error: 'Upptakan er of stór (hámark ~4 MB). Reyndu styttra verkefni.' });
      return;
    }

    const contentType = req.headers['content-type'] || 'audio/wav';
    const ext = contentType.includes('webm') ? 'webm'
              : contentType.includes('ogg')  ? 'ogg'
              : contentType.includes('mp4') || contentType.includes('m4a') ? 'mp4'
              : 'wav';

    const form = new FormData();
    form.append('file', new Blob([audio], { type: contentType }), 'audio.' + ext);
    form.append('model', 'whisper-1');
    form.append('language', 'is'); // íslenska
    // smá hjálp svo Whisper þekki algeng verkefnaorð
    form.append('prompt', 'Verkefni, dagsetning, klukkan, mjög mikilvægt, áríðandi, á morgun, í dag.');

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
    });

    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: 'Umritun mistókst (' + r.status + '): ' + t.slice(0, 180) });
      return;
    }

    const data = await r.json();
    res.status(200).json({ text: (data && data.text) ? data.text : '' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};

// Slökkva á sjálfvirkri body-greiningu svo við fáum hráa hljóðstrauminn
module.exports.config = { api: { bodyParser: false } };
