<script>
  (() => {
    // --- Demo catalog (replace with your own streams) ---
    /** NOTE: These are common royalty-free sample MP3 URLs. You can replace or remove them. */
    const DEMO = [
      {
        id: crypto.randomUUID(),
        title: "SoundHelix Song 1",
        artist: "T. Schürger",
        art: "https://picsum.photos/seed/helix1/600/600",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        type: "audio/mpeg", duration: null
      },
      {
        id: crypto.randomUUID(),
        title: "SoundHelix Song 2",
        artist: "T. Schürger",
        art: "https://picsum.photos/seed/helix2/600/600",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        type: "audio/mpeg", duration: null
      },
      {
        id: crypto.randomUUID(),
        title: "Acoustic Breeze",
        artist: "Royalty Free",
        art: "https://picsum.photos/seed/acoustic/600/600",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        type: "audio/mpeg", duration: null
      }
    ];

    // --- State ---
    let queue = [...DEMO];
    let filtered = [...queue];
    let index = 0;
    let isPlaying = false;
    let shuffle = JSON.parse(localStorage.getItem("ts.shuffle") || "false");
    /** repeat: 'off' | 'one' | 'all' */
    let repeat = localStorage.getItem("ts.repeat") || "off";

    // --- DOM ---
    const $ = sel => document.querySelector(sel);
    const tracksEl = $("#tracks");
    const audio = $("#audio");
    const nowTitle = $("#nowTitle");
    const nowArtist = $("#nowArtist");
    const artImg = $("#artImg");
    const chipType = $("#chipType");
    const chipBitrate = $("#chipBitrate");
    const chipSize = $("#chipSize");
    const timeCur = $("#timeCur");
    const timeDur = $("#timeDur");
    const seek = $("#seek");
    const vol = $("#vol");
    const btnPlay = $("#btnPlay");
    const btnNext = $("#btnNext");
    const btnPrev = $("#btnPrev");
    const btnMute = $("#btnMute");
    const btnShuffle = $("#btnShuffle");
    const btnRepeat = $("#btnRepeat");
    const btnSave = $("#btnSave");
    const btnLoad = $("#btnLoad");
    const btnClear = $("#clearQueueBtn");
    const addUrlBtn = $("#addUrlBtn");
    const fileInput = $("#fileInput");
    const search = $("#search");
    const dropmask = $("#dropmask");

    // --- Utils ---
    const fmtTime = s => {
      if (isNaN(s) || !isFinite(s)) return "0:00";
      const m = Math.floor(s/60);
      const sec = Math.floor(s%60).toString().padStart(2,"0");
      return `${m}:${sec}`;
    };
    const estimateBitrate = (sizeBytes, durationSec) => {
      if (!sizeBytes || !durationSec) return null;
      return Math.round((sizeBytes * 8) / 1000 / durationSec); // kbps
    };
    const humanSize = bytes => {
      if (!bytes && bytes !== 0) return "—";
      const units = ["B","KB","MB","GB"]; let i=0; let n=bytes;
      while(n>=1024 && i<units.length-1){ n/=1024; i++; }
      return `${n.toFixed(n<10 && i>0 ? 1 : 0)} ${units[i]}`;
    };

    // --- Render ---
    function renderList() {
      tracksEl.innerHTML = "";
      filtered.forEach((t, i) => {
        const li = document.createElement("div");
        li.className = "track" + (queue[index]?.id === t.id ? " active" : "");
        li.setAttribute("role","option");
        li.dataset.id = t.id;
        li.innerHTML = `
          <div class="cover">${t.art ? `<img alt="" src="${t.art}">` : "🎵"}</div>
          <div class="meta">
            <div class="title" title="${t.title}">${t.title}</div>
            <div class="artist" title="${t.artist || ""}">${t.artist || ""}</div>
          </div>
          <div class="dur">${t.duration ? fmtTime(t.duration) : ""}</div>
        `;
        li.addEventListener("click", () => {
          index = queue.findIndex(q => q.id === t.id);
          load(index, true);
        });
        tracksEl.appendChild(li);
      });
    }

    function updateNow() {
      const t = queue[index];
      if(!t) return;
      nowTitle.textContent = t.title || "Unknown title";
      nowArtist.textContent = t.artist || "Unknown artist";
      artImg.src = t.art || "https://picsum.photos/seed/ts-cover/800/800";
      chipType.textContent = (t.type || audio.currentSrc.split("?")[0].split(".").pop() || "audio").toUpperCase();
    }

    function updateButtons(){
      btnShuffle.classList.toggle("active", shuffle);
      const rIcon = repeat === "one" ? "🔂" : (repeat === "all" ? "🔁" : "🔁");
      btnRepeat.textContent = rIcon;
      btnRepeat.classList.toggle("active", repeat !== "off");
      btnPlay.textContent = isPlaying ? "⏸" : "▶️";
      btnMute.textContent = audio.muted ? "🔇" : (audio.volume <= .33 ? "🔈" : audio.volume < .9 ? "🔉" : "🔊");
    }

    // --- Playback ---
    async function load(i, autoplay=false){
      index = (i + queue.length) % queue.length;
      const t = queue[index];
      if(!t) return;
      audio.src = t.url;
      audio.type = t.type || "";
      updateNow();
      if (autoplay) {
        try { await audio.play(); isPlaying = true; } catch (e) { isPlaying = false; }
      }
      renderList();
      updateButtons();
      setupMediaSession(t);
    }

    async function playPause(){
      if (audio.paused) {
        try { await audio.play(); isPlaying = true; }
        catch { isPlaying = false; }
      } else { audio.pause(); isPlaying = false; }
      updateButtons();
    }

    function next(){
      if (shuffle) {
        let n;
        if (queue.length <= 1) n = index;
        else {
          do { n = Math.floor(Math.random()*queue.length); } while(n === index);
        }
        load(n, true);
      } else if (repeat === "one") {
        audio.currentTime = 0; audio.play(); isPlaying=true; updateButtons();
      } else {
        const n = index + 1;
        if (n >= queue.length) {
          if (repeat === "all") load(0, true);
          else { isPlaying=false; updateButtons(); }
        } else load(n, true);
      }
    }
    function prev(){
      if (audio.currentTime > 2) { audio.currentTime = 0; return; }
      const p = index - 1;
      load(p < 0 ? queue.length - 1 : p, true);
    }

    // --- Wire up controls ---
    btnPlay.addEventListener("click", playPause);
    btnNext.addEventListener("click", next);
    btnPrev.addEventListener("click", prev);
    btnMute.addEventListener("click", () => { audio.muted = !audio.muted; updateButtons(); });

    btnShuffle.addEventListener("click", () => {
      shuffle = !shuffle;
      localStorage.setItem("ts.shuffle", JSON.stringify(shuffle));
      updateButtons();
    });

    btnRepeat.addEventListener("click", () => {
      repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
      localStorage.setItem("ts.repeat", repeat);
      updateButtons();
    });

    // Seek / volume
    audio.addEventListener("timeupdate", () => {
      timeCur.textContent = fmtTime(audio.currentTime);
      timeDur.textContent = fmtTime(audio.duration || 0);
      const v = audio.duration ? Math.min(1000, Math.max(0, Math.floor((audio.currentTime / audio.duration) * 1000))) : 0;
      if (!seek.dragging) seek.value = v;
    });
    audio.addEventListener("durationchange", () => {
      timeDur.textContent = fmtTime(audio.duration || 0);
      // Attempt to compute bitrate when content-length available
      fetchHead(queue[index]?.url).then(meta => {
        const kbps = estimateBitrate(meta.size, audio.duration);
        chipBitrate.textContent = kbps ? `${kbps} kbps` : "— kbps";
        chipSize.textContent = humanSize(meta.size);
      }).catch(() => { chipBitrate.textContent = "— kbps"; chipSize.textContent = "—"; });
    });
    audio.addEventListener("ended", next);
    seek.addEventListener("input", () => {
      seek.dragging = true;
      if (audio.duration) audio.currentTime = (seek.value/1000) * audio.duration;
    });
    seek.addEventListener("change", () => { seek.dragging=false; });

    vol.addEventListener("input", () => { audio.volume = parseFloat(vol.value); updateButtons(); });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); playPause(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key.toLowerCase() === "m") { audio.muted = !audio.muted; updateButtons(); }
      else if (e.key.toLowerCase() === "s") { shuffle = !shuffle; localStorage.setItem("ts.shuffle", JSON.stringify(shuffle)); updateButtons(); }
      else if (e.key.toLowerCase() === "r") { btnRepeat.click(); }
    });

    // Search filter
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      filtered = queue.filter(t =>
        (t.title||"").toLowerCase().includes(q) ||
        (t.artist||"").toLowerCase().includes(q)
      );
      renderList();
    });

    // Save / Load queue
    btnSave.addEventListener("click", () => {
      const data = { queue, index, t: Date.now() };
      localStorage.setItem("ts.queue", JSON.stringify(data));
      toast("Queue saved locally ✔️");
    });
    btnLoad.addEventListener("click", () => {
      const raw = localStorage.getItem("ts.queue");
      if(!raw) return toast("No saved queue found 🤔");
      try{
        const data = JSON.parse(raw);
        queue = data.queue || [];
        filtered = [...queue];
        index = Math.min(data.index ?? 0, queue.length-1);
        renderList(); load(index, false);
        toast("Queue loaded 💡");
      }catch{ toast("Failed to load queue ❗"); }
    });

    // Clear queue
    btnClear.addEventListener("click", () => {
      if (!confirm("Clear the entire queue?")) return;
      queue = []; filtered = []; index = 0; audio.removeAttribute("src"); audio.load();
      renderList(); updateNow(); timeCur.textContent = "0:00"; timeDur.textContent = "0:00"; isPlaying=false; updateButtons();
    });

    // Add by URL
    addUrlBtn.addEventListener("click", async () => {
      const url = prompt("Paste a direct audio URL (MP3/OGG/M4A):");
      if (!url) return;
      const meta = await probeUrl(url).catch(()=>({title:"Unknown", artist:""}));
      const track = {
        id: crypto.randomUUID(),
        title: meta.title || url.split("/").pop() || "Track",
        artist: meta.artist || "",
        art: meta.art || "https://picsum.photos/seed/cover" + Math.random().toString(36).slice(2) + "/600/600",
        url, type: meta.type || "", duration: null
      };
      queue.push(track); filtered = [...queue]; renderList();
      toast("Added to queue ✔️");
    });

    // Upload files
    fileInput.addEventListener("change", () => addFiles([...fileInput.files]));
    ;["dragenter","dragover"].forEach(ev => window.addEventListener(ev, e => {
      e.preventDefault(); dropmask.classList.add("show");
    }));
    ;["dragleave","drop"].forEach(ev => window.addEventListener(ev, e => {
      if (ev === "drop") return; e.preventDefault(); dropmask.classList.remove("show");
    }));
    window.addEventListener("drop", e => {
      e.preventDefault(); dropmask.classList.remove("show");
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith("audio/"));
      addFiles(files);
    });

    function addFiles(files){
      if (!files.length) return;
      const newTracks = files.map(f => ({
        id: crypto.randomUUID(),
        title: f.name.replace(/\.[^.]+$/,''),
        artist: "Local file",
        art: "https://picsum.photos/seed/" + encodeURIComponent(f.name) + "/600/600",
        url: URL.createObjectURL(f), type: f.type, size: f.size, duration: null
      }));
      queue.push(...newTracks);
      filtered = [...queue];
      renderList();
      toast(`Added ${newTracks.length} file(s) ✔️`);
    }

    // Media Session API
    function setupMediaSession(t){
      if (!("mediaSession" in navigator) || !t) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title || "",
        artist: t.artist || "",
        album: "TinyStream",
        artwork: [{src: t.art || "", sizes: "512x512", type: "image/png"}]
      });
      navigator.mediaSession.setActionHandler("play", () => { audio.play(); isPlaying=true; updateButtons(); });
      navigator.mediaSession.setActionHandler("pause", () => { audio.pause(); isPlaying=false; updateButtons(); });
      navigator.mediaSession.setActionHandler("previoustrack", prev);
      navigator.mediaSession.setActionHandler("nexttrack", next);
      navigator.mediaSession.setActionHandler("seekto", (d) => { if (d.seekTime!=null) audio.currentTime = d.seekTime; });
    }

    // Lightweight HEAD fetch to read content-length/mime
    async function fetchHead(url){
      const res = await fetch(url, { method:"HEAD" });
      const len = parseInt(res.headers.get("content-length") || "0", 10);
      const type = res.headers.get("content-type") || "";
      return { size: len || null, type: type || null };
    }
    async function probeUrl(url){
      try{
        const head = await fetchHead(url);
        return { type: head.type };
      }catch(e){ return {}; }
    }

    function toast(msg){
      const el = document.createElement("div");
      el.textContent = msg;
      Object.assign(el.style, {
        position:"fixed", bottom:"20px", left:"50%", transform:"translateX(-50%)",
        background:"#0b132a", color:"#cfe1ff", border:"1px solid #1f2a44",
        padding:"10px 14px", borderRadius:"10px", zIndex:1000, boxShadow:"0 10px 30px #0008"
      });
      document.body.appendChild(el);
      setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .3s"; }, 1500);
      setTimeout(()=> el.remove(), 1900);
    }

    // Init
    function init(){
      const savedShuffle = localStorage.getItem("ts.shuffle");
      if (savedShuffle != null) shuffle = JSON.parse(savedShuffle);
      const savedRepeat = localStorage.getItem("ts.repeat");
      if (savedRepeat != null) repeat = savedRepeat;

      updateButtons();
      filtered = [...queue];
      renderList();
      load(0, false);

      // Persist current volume
      const sv = localStorage.getItem("ts.volume");
      if (sv != null) { const v = parseFloat(sv); audio.volume = v; vol.value = v; }
      vol.addEventListener("change", () => localStorage.setItem("ts.volume", audio.volume.toString()));
    }
    init();
  })();
  </script>