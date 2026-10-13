#!/usr/bin/env node
/* Builds the static pages. No framework, no dependencies: node tools/build.js
   Pages are plain HTML written to the site root. Every URL inside a page is RELATIVE, so the same files work at
   playpen.site, at <user>.github.io/<repo>/, and on Cloudflare Pages without a change. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://playpen.site';
const RELEASES_REPO = 'lsaiahflores/playpen-releases';
const CONTACT = 'hello@playpen.site';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout({ file, title, description, body, depth, nav = '', noindex = false, scripts = [], bodyClass = '', canonical, og = true }) {
  const b = '../'.repeat(depth);
  const url = SITE + '/' + (canonical !== undefined ? canonical : file.replace(/index\.html$/, ''));
  const navLink = (href, label, key) => `<a href="${b}${href}"${nav === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#08090c">
<meta name="color-scheme" content="dark">
${noindex ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co https://api.github.com; base-uri 'self'; form-action 'self'; object-src 'none'">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/svg+xml" href="${b}img/favicon.svg">
<link rel="preload" href="${b}fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${b}fonts/inter-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${b}css/site.css">
${og ? `<meta property="og:type" content="website">
<meta property="og:site_name" content="Playpen">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Playpen logo on a black background, with the words: Say what you want to make. Play it.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/img/og.png">
` : ''}<script src="${b}js/boot.js"></script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to the content</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="${b || './'}"><img src="${b}img/logo-mark.svg" alt="" width="26" height="26"><span>Playpen</span></a>
    <nav class="nav" aria-label="Main">
      <a href="${b || './'}#how">How it works</a>
      ${navLink('parents/', 'For parents', 'parents')}
      ${navLink('faq/', 'FAQ', 'faq')}
      <a class="btn primary" href="${b}download/"${nav === 'download' ? ' aria-current="page"' : ''}>Download</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div><a class="brand" href="${b || './'}"><img src="${b}img/logo-mark.svg" alt="" width="26" height="26"><span>Playpen</span></a></div>
    <nav aria-label="Footer">
      <a href="${b}download/">Download</a>
      <a href="${b}parents/">For parents</a>
      <a href="${b}faq/">FAQ</a>
      <a href="mailto:${CONTACT}">Contact</a>
    </nav>
    <p class="foot-small">Playpen is free to use. It makes games and apps on your own computer. ${CONTACT}</p>
  </div>
</footer>
${scripts.map((s) => `<script src="${b}js/${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}

const pages = [];
const add = (p) => pages.push(p);

/* ---------------------------------------------------------------- HOME */
add({
  file: 'index.html', depth: 0, nav: '',
  title: 'Playpen: say what you want to make, then play it',
  description: 'Playpen is a free Windows app that builds real games and apps from a conversation, with no setup.',
  scripts: ['galaxy.js', 'demo.js', 'toggle.js', 'config.js', 'signup.js'],
  body: `
<section class="hero" aria-labelledby="hero-title">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1 id="hero-title">Say what you want to make. Play it.</h1>
      <p class="lede">Playpen is a free Windows app that builds real games and apps from a conversation, with no setup.</p>
      <div class="btn-row">
        <a class="btn primary" href="download/">Download for Windows</a>
        <a class="btn" href="#beta">Join the beta</a>
      </div>
      <p class="hero-note">Windows 10 or 11. Free to use. Claude features use your own Claude subscription.</p>
    </div>
    <div class="galaxy">
      <div class="galaxy-stage" id="galaxy-stage" tabindex="0" role="group" aria-roledescription="carousel" aria-label="What Playpen does. Use the left and right arrow keys, drag, or the numbered buttons to move around.">
        <canvas id="galaxy" aria-hidden="true"></canvas>
      </div>
      <div class="galaxy-caption" id="galaxy-caption" aria-live="off">
        <div class="cap-no" id="cap-no">1 / 10</div>
        <h2 id="cap-title">Hybrid: local and Claude, together</h2>
        <p id="cap-text">Playpen’s own AI and your Claude subscription share the work. Or use either one on its own.</p>
      </div>
      <ol class="stations" id="stations"></ol>
      <p class="galaxy-hint">Drag, swipe, or use the arrow keys to turn it.</p>
      <div class="nojs-stations prose" hidden>
        <ol>
          <li><b>Hybrid.</b> Playpen’s own AI and your Claude subscription share the work, or work alone.</li>
          <li><b>A project that remembers itself.</b> Every piece keeps its own notes on your computer.</li>
          <li><b>Nothing to set up.</b> Playpen gets its own tools ready the first time you open it.</li>
          <li><b>Test it as it’s built.</b> Your game runs inside Playpen. Controllers work.</li>
          <li><b>Send it to your phone.</b> Scan a code. Same Wi‑Fi.</li>
          <li><b>Talk it into existence.</b> Say what you want and Playpen builds it.</li>
          <li><b>Build real games.</b> Platformers, shooters, racing and more.</li>
          <li><b>Plan ahead, any time.</b> With Claude or fully local.</li>
          <li><b>See your code, simply.</b> One file at a time, in plain English.</li>
          <li><b>Built for kids, run by a parent.</b> A PIN-protected Child Lock.</li>
        </ol>
      </div>
    </div>
  </div>
</section>

<section class="rule" id="demo" aria-labelledby="demo-title">
  <div class="wrap">
    <div class="demo-head">
      <div>
        <p class="eyebrow">Watch a build</p>
        <h2 id="demo-title">One game, start to finish</h2>
      </div>
      <p>A recreation of the Playpen window, sped up. The game in it is made up for this page.</p>
    </div>
    <div class="demo-layout">
      <div>
        <div class="app" id="demo-app" data-mode="local">
          <div class="app-bar">
            <div class="app-title"><img src="img/logo-mark.svg" alt="" width="18" height="18">Playpen</div>
            <div class="seg" id="app-mode" aria-hidden="true"><span data-m="local" class="on">Local</span><span data-m="hybrid">Hybrid</span><span data-m="claude">Claude</span></div>
            <div class="app-tabs" aria-hidden="true"><span class="tab on" data-t="chat">Chat</span><span class="tab" data-t="plan">Plan</span></div>
            <div class="app-actions" aria-hidden="true"><span class="app-chip" id="app-phone">Send to phone</span></div>
            <div class="toast" id="app-toast" aria-hidden="true"></div>
          </div>
          <div class="app-body" aria-hidden="true">
            <div class="pane terminal"><div class="pane-head"><span>Terminal</span><span>Playpen + Claude Code</span></div><div class="term-lines" id="term-lines"></div></div>
            <div class="pane chat">
              <div class="pane-head"><span>Chat</span><span>Hybrid</span></div>
              <div class="chat-scroll" id="chat-scroll"></div>
              <div class="progress" id="build-progress"><i></i></div>
              <div class="plan-view" id="plan-view">
                <div class="planhead">Plan</div>
                <div class="mod">
                  <h4>Redesign main character</h4>
                  <ul><li>Swap the round blob for a fox</li><li>Keep the same size and speed</li><li>Test that the chase still feels fair</li></ul>
                  <span class="go">Build</span>
                </div>
              </div>
            </div>
            <div class="pane test"><div class="pane-head"><span>Test</span><span>Hedgerow Chase</span></div><div class="test-canvas"><canvas id="test-canvas"></canvas><span class="test-tag" id="test-tag"></span></div></div>
          </div>
        </div>
        <div class="demo-controls">
          <button class="btn" id="demo-play" type="button" aria-pressed="false">Play</button>
          <button class="btn" id="demo-replay" type="button">Replay</button>
          <span class="demo-steps" id="demo-steps"><button class="btn" id="demo-prev" type="button">Previous step</button><button class="btn" id="demo-next" type="button">Next step</button></span>
          <button class="btn" id="demo-mute" type="button" aria-pressed="true">Sound off</button>
          <span class="sped">Sped up</span>
        </div>
        <p class="demo-caption" id="demo-caption" aria-live="polite"></p>
        <details class="transcript">
          <summary>Read what happens in the demo</summary>
          <ol>
            <li>You switch Playpen to Hybrid mode.</li>
            <li>You say: &ldquo;Make me a 3D maze-chase game.&rdquo;</li>
            <li>The terminal opens. Playpen’s local AI and Claude Code shake hands. Playpen saves a restore point first.</li>
            <li>They build the game together. Simpler pieces go to the local model and harder ones go to Claude Code. Each line in the terminal says which one wrote it.</li>
            <li>The voice assistant says: &ldquo;Your game is ready to test.&rdquo;</li>
            <li>The test pane opens and the game is playing.</li>
            <li>You ask for a new look for the main character. Your Claude usage limit is reached.</li>
            <li>You switch to Local, open the Plan tab, and plan a &ldquo;redesign main character&rdquo; module with the local model.</li>
            <li>Claude usage comes back. You send the module to the build, and the game plays again with a fox as the hero.</li>
            <li>You send the game to your phone.</li>
          </ol>
        </details>
      </div>
      <aside class="qr-card" aria-label="Play a sample on your phone">
        <div class="qr"><img src="img/qr-play.svg" alt="QR code that opens the sample play page on this site" width="172" height="172"></div>
        <h3>Try it on your phone</h3>
        <p>Scan this with your phone’s camera. It opens a page on this site and runs in your phone’s browser, with touch controls.</p>
        <p class="placeholder-note muted">A real Playpen-made game will live here. For now it opens a stand-in page.</p>
        <p><a href="play/maze/">Open it here instead</a></p>
      </aside>
    </div>
  </div>
</section>

<section class="rule" id="how" aria-labelledby="how-title">
  <div class="wrap how-grid">
    <div>
      <p class="eyebrow">How it works</p>
      <h2 id="how-title">You choose who does the building</h2>
      <p class="lede">Playpen has three modes. Try each one.</p>
      <div class="mode-toggle" id="mode-toggle" role="radiogroup" aria-label="Playpen mode">
        <span class="thumb" aria-hidden="true"></span>
        <button type="button" role="radio" aria-checked="false" data-mode="local" tabindex="-1">Local</button>
        <button type="button" role="radio" aria-checked="true" data-mode="hybrid" tabindex="0">Hybrid</button>
        <button type="button" role="radio" aria-checked="false" data-mode="claude" tabindex="-1">Claude</button>
      </div>
      <div class="mode-panel" id="mode-panel" aria-live="polite">
        <h3>Two builders on one project</h3>
        <p>Playpen splits a build into pieces. Simpler coding goes to the local model, in the terminal. Harder, higher-level work goes to Claude. You get more done and use less of your Claude usage.</p>
      </div>
      <template data-mode="local">
        <h3>Everything on your computer</h3>
        <p>A local AI model runs on your own PC through Ollama. It’s free, it’s private, and once Playpen is set up it works with no internet. How well it builds depends on your hardware and the model. A 32 GB PC can run bigger, stronger models.</p>
        <ul><li>No account needed.</li><li>Your projects and prompts stay on your computer.</li><li>You can still plan, build and test, just with a smaller brain.</li></ul>
      </template>
      <template data-mode="hybrid">
        <h3>Two builders on one project</h3>
        <p>Playpen splits a build into pieces. Simpler coding goes to the local model, in the terminal. Harder, higher-level work goes to Claude. You get more done and use less of your Claude usage.</p>
        <ul><li>Each piece goes to whichever builder fits it best.</li><li>You can always push a piece up to Claude. Playpen never quietly drops a hard piece down to the local model.</li><li>If Claude’s usage runs out, flip to Local and keep planning.</li></ul>
      </template>
      <template data-mode="claude">
        <h3>Full power, your own account</h3>
        <p>Playpen is built on Claude Code. In Claude mode it uses your own Claude subscription directly, on your computer. Your account is never proxied or shared.</p>
        <ul><li>Claude Code needs a paid Claude plan (Pro, Max, Team or Enterprise) or an API account.</li><li>The strongest results, for the biggest builds.</li><li>Your requests go to Claude, exactly as if you ran Claude Code yourself.</li></ul>
      </template>
    </div>
    <div class="under">
      <h3>What’s underneath</h3>
      <dl>
        <div class="row"><dt>A desktop app</dt><dd>Playpen is an Electron app that runs on your PC.</dd></div>
        <div class="row"><dt>Claude Code</dt><dd>The Claude side runs through Claude Code, installed and signed in on your machine.</dd></div>
        <div class="row"><dt>A local model</dt><dd>Ollama runs the local AI on your computer. Playpen picks one that fits your PC.</dd></div>
        <div class="row"><dt>Restore points</dt><dd>Playpen saves your project with git before every build, so you can always go back.</dd></div>
        <div class="row"><dt>A brain per project</dt><dd>Each project keeps its notes, plans and history in a folder on your computer. That is what gives every request its context.</dd></div>
        <div class="row"><dt>No Playpen servers</dt><dd>Nothing runs on our servers, because we don’t have any. Your projects live on your computer.</dd></div>
      </dl>
    </div>
  </div>
</section>

<section class="signup" id="beta" aria-labelledby="beta-title">
  <div class="wrap signup-grid">
    <div>
      <p class="eyebrow">Beta</p>
      <h2 id="beta-title">We’re looking for beta testers.</h2>
    </div>
    <form id="beta-form" novalidate>
      <div class="form-row">
        <label class="sr" for="beta-email">Email address</label>
        <input id="beta-email" type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>
        <button class="btn primary" id="beta-submit" type="submit">Join the beta</button>
      </div>
      <label class="check"><input id="beta-updates" type="checkbox" name="wants_updates"><span>Send me updates</span></label>
      <p class="form-note">We keep your email address, whether you ticked the box, and the date. We use it to invite you to the beta and, if you ticked the box, to tell you what’s new. Email ${CONTACT} and we’ll delete it.</p>
      <p class="form-status" id="beta-status" role="status"></p>
    </form>
  </div>
</section>

<section class="why" aria-labelledby="why-title">
  <div class="wrap">
    <p class="eyebrow" id="why-title">Why it exists</p>
    <p>Playpen started with a dad trying to teach his son to make a real game, and spending a week on setup the kid would never need.</p>
    <p>Powerful AI tools shouldn’t be locked behind cost or setup. So Playpen is free, and it sets itself up.</p>
  </div>
</section>`
});

/* ---------------------------------------------------------------- DOWNLOAD */
add({
  file: 'download/index.html', depth: 1, nav: 'download', scripts: ['download.js'],
  title: 'Download Playpen for Windows',
  description: 'Download Playpen for Windows. Free. Version, size and SHA-256 checksum shown for every release.',
  body: `
<div class="wrap">
  <div class="page-head">
    <p class="eyebrow">Download</p>
    <h1>Playpen for Windows</h1>
    <p class="lede">Free. Windows 10 or 11, 64-bit. Mac and Linux aren’t available yet.</p>
  </div>
  <div class="prose">
    <div class="dl-card" id="dl-live" data-repo="${RELEASES_REPO}">
      <div>
        <dl class="dl-meta">
          <dt>Version</dt><dd id="dl-version">Checking…</dd>
          <dt>Size</dt><dd id="dl-size">&nbsp;</dd>
          <dt>File</dt><dd id="dl-file">&nbsp;</dd>
          <dt>SHA-256</dt><dd id="dl-sha">&nbsp;</dd>
        </dl>
        <p class="muted" id="dl-status" role="status"></p>
      </div>
      <a class="btn primary" id="dl-button" href="https://github.com/${RELEASES_REPO}/releases/latest">Download for Windows</a>
    </div>
    <p class="muted">The installer comes from this project’s public releases page on GitHub. Nothing is signed up for or tracked here.</p>

    <h2>What you need</h2>
    <ul>
      <li><b>Windows 10 or 11</b>, 64-bit.</li>
      <li><b>Memory:</b> 8 GB works with a small local model. 16 GB or more is better. 32 GB runs the bigger models well.</li>
      <li><b>Disk space:</b> a few gigabytes for Playpen’s tools and a first model, and more if you choose a bigger local model.</li>
      <li><b>Internet</b> for the first-time setup, and for Claude if you use it.</li>
      <li><b>For Claude or Hybrid mode:</b> a paid Claude plan (Pro, Max, Team or Enterprise) or an API account, since Claude Code needs one. Local mode needs no account.</li>
    </ul>

    <h2>If Windows says it protected your PC</h2>
    <p>When you run the installer, Windows may show a blue box that says <i>Windows protected your PC</i>. Click <b>More info</b>, then <b>Run anyway</b>.</p>
    <p>This happens because Playpen’s installer isn’t code-signed yet. Code-signing certificates cost money, and Playpen is free and just getting started. Windows shows that warning for any new, unsigned app.</p>
    <p>To check that your file is the real one, compare its checksum with the SHA-256 shown above. In PowerShell:</p>
    <p><code>Get-FileHash .\\Playpen-Setup-*.exe -Algorithm SHA256</code></p>

    <h2>After you install</h2>
    <p>The first time you open Playpen it sets up the tools it needs and picks a local model that fits your computer. That takes a few minutes and needs the internet. After that you just say what you want to make.</p>
  </div>
</div>`
});

/* ---------------------------------------------------------------- PARENTS */
add({
  file: 'parents/index.html', depth: 1, nav: 'parents',
  title: 'Playpen for parents: Child Lock, data and limits',
  description: 'What Playpen’s Child Lock does, what it can’t do, what data Playpen keeps, and how to reach us.',
  body: `
<div class="wrap">
  <div class="page-head">
    <p class="eyebrow">For parents</p>
    <h1>Built for kids, run by a parent</h1>
    <p class="lede">Playpen has a PIN-protected Child Lock. Here is what it does, and what it can’t do.</p>
  </div>
  <div class="prose">
    <h2>What Child Lock does</h2>
    <ul>
      <li><b>A PIN and a recovery phrase.</b> You choose a 6-digit PIN. You also get a recovery phrase, shown once. There is no email or cloud reset.</li>
      <li><b>What can be made.</b> You choose which categories are blocked (violence, adult content, drugs, self-harm) and can add your own words. Matching works on whole words and catches common tricks like spaced-out letters.</li>
      <li><b>When it can be used.</b> You can set daily hours. Outside them, nothing new can be started. If the hours end while a game or app is running, the child sees a “Time’s up for today” screen and it stops.</li>
      <li><b>Local only.</b> You can keep everything on the computer so nothing is sent to Claude.</li>
      <li><b>Homework mode.</b> Playpen guides instead of handing over final answers.</li>
      <li><b>A grown-up has to approve changes.</b> Changing the AI model, deleting a project, sharing to a phone, downloads, and the usage alert all ask for the PIN first.</li>
      <li><b>It checks what Playpen makes, too.</b> Names, text and strings in a build are checked against your rules before it is handed over. A build that trips them is stopped and logged for you, in plain words.</li>
      <li><b>If someone tampers with it, it stays locked.</b> If Child Lock’s settings go missing or are edited, it keeps your last settings and only the recovery phrase reopens it.</li>
    </ul>

    <h2>What Child Lock can’t do</h2>
    <p>Please read this part.</p>
    <ul>
      <li><b>Anyone who can use your Windows account can get around it.</b> A lock inside an app can’t stop someone who can change files on the same account. For stronger protection, <b>give your child their own Windows account</b> and keep yours separate.</li>
      <li><b>It reads words, not pictures or sound.</b> It can’t see what an image looks like or what an audio clip says. Other languages and clever wording can slip past a word list.</li>
      <li><b>It isn’t a promise about the AI.</b> AI models make mistakes. Child Lock adds checks around them. It doesn’t make them perfect.</li>
      <li><b>Time limits use the computer’s clock.</b></li>
    </ul>

    <h2>What data there is</h2>
    <ul>
      <li><b>Projects and chats</b> live in a Playpen folder on the computer. Playpen has no servers of its own, so nothing is uploaded to us.</li>
      <li><b>When Claude is used,</b> the request goes to Claude, the same as using Claude Code directly. Child Lock can turn that off so everything stays local. If you allow Claude, Playpen removes obvious personal details (phone numbers, street addresses, a stated full name or school) from what it sends. That is a reduction, not a guarantee.</li>
      <li><b>This website</b> has no cookies, no trackers and no ad scripts. The only thing it collects is an email address, if you join the beta list.</li>
      <li><b>The app</b> doesn’t send usage analytics today. If that ever changes, we will say so here first.</li>
    </ul>

    <h2>Deleting data</h2>
    <p>To delete the beta list email, write to <a href="mailto:${CONTACT}">${CONTACT}</a>. To delete projects, delete them in Playpen (it asks a grown-up first) or delete the Playpen folder in your user folder. Uninstalling Playpen doesn’t delete your projects.</p>

    <h2>Published games</h2>
    <p>Publishing games publicly isn’t part of Playpen yet. When it is, this page will explain how published games are handled, and how to report one. Until then, if you see something that shouldn’t be here, write to <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
  </div>
</div>`
});

/* ---------------------------------------------------------------- FAQ */
const faqItems = [
  ['Is Playpen free?', 'Playpen itself is free. Local mode needs no account and costs nothing. Claude mode and Hybrid mode use your own Claude subscription: Claude Code needs a paid Claude plan (Pro, Max, Team or Enterprise) or an API account, and the free Claude plan doesn’t include it. Playpen doesn’t add a charge on top.'],
  ['Does it work offline?', 'Yes, in Local mode, once Playpen has finished its first-time setup. That setup needs the internet. Claude mode needs the internet. Sending a game to your phone works over your home Wi‑Fi, and your phone and PC need to be on the same network.'],
  ['Where do my games live?', 'In a Playpen folder in your user folder on your own computer, with one folder per project. They’re not uploaded anywhere.'],
  ['Can I sell what I make?', 'It’s your project and Playpen doesn’t claim it. But games can include free art, sound and music packs that come with their own licences, and Playpen lists credits for them. We can’t give legal advice, so check those licences before you sell something.'],
  ['Which AI does it use?', 'Two kinds. A local model that runs on your computer through Ollama, which Playpen picks to fit your PC, and Claude, through Claude Code. In Hybrid mode both work on the same project.'],
  ['What can it make?', 'Real games, such as platformers, shooters and racing games, and small apps. It sets up the project, writes the code, adds sound and music, and lets you test it right away.'],
  ['Does it run on Mac or Linux?', 'Not yet. Playpen is Windows only for now.'],
  ['Is it safe for kids?', 'There is a PIN-protected Child Lock, with honest limits. The For parents page explains both.'],
  ['Why does Windows warn me about the installer?', 'Because the installer isn’t code-signed yet. The Download page shows the exact steps to continue, and a checksum so you can verify the file.']
];
add({
  file: 'faq/index.html', depth: 1, nav: 'faq',
  title: 'Playpen FAQ',
  description: 'Is Playpen free, does it work offline, where do my games live, and which AI does it use.',
  body: `
<div class="wrap">
  <div class="page-head">
    <p class="eyebrow">FAQ</p>
    <h1>Questions people ask</h1>
  </div>
  <div class="faq prose">
${faqItems.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
  </div>
  <p class="muted prose">Something else? <a href="mailto:${CONTACT}">${CONTACT}</a></p>
</div>`
});

/* ---------------------------------------------------------------- TERMS / PRIVACY (drafts: noindex, not linked) */
const draftBanner = '<p class="draft-banner"><b>Draft. Pending legal review.</b> This page is not final and is not linked from the site.</p>';
add({
  file: 'terms/index.html', depth: 1, noindex: true, og: false,
  title: 'Playpen terms (draft)',
  description: 'Draft terms for using Playpen. Pending legal review.',
  body: `<!-- Draft: pending legal review. noindex. Not linked from the footer until approved. -->
<div class="wrap">
  <div class="page-head"><p class="eyebrow">Draft</p><h1>Terms of use</h1></div>
  <div class="prose">
    ${draftBanner}
    <h2>The short version</h2>
    <p>Playpen is software that helps you make games and apps on your own computer. You own what you make. You’re responsible for how you use it.</p>
    <h2>Using Playpen</h2>
    <ul>
      <li>You may use Playpen for personal and commercial projects.</li>
      <li>Children should use Playpen with a parent’s permission.</li>
      <li>Don’t use Playpen to make things that are illegal or that harm others.</li>
    </ul>
    <h2>Your projects</h2>
    <p>Projects are stored on your computer. We don’t claim ownership of what you make. Some included assets come with their own licences, which are listed in each project.</p>
    <h2>AI services</h2>
    <p>Playpen can use local AI models and, if you choose, Claude through your own Claude account. Your use of Claude is under Anthropic’s terms. AI output can be wrong; check it before relying on it.</p>
    <h2>No warranty</h2>
    <p>Playpen is provided as is, while it is in beta. We can’t promise it will be free of errors.</p>
    <h2>Contact</h2>
    <p><a href="mailto:${CONTACT}">${CONTACT}</a></p>
  </div>
</div>`
});
add({
  file: 'privacy/index.html', depth: 1, noindex: true, og: false,
  title: 'Playpen privacy (draft)',
  description: 'Draft privacy notice for Playpen and this website. Pending legal review.',
  body: `<!-- Draft: pending legal review. noindex. Not linked from the footer until approved. -->
<div class="wrap">
  <div class="page-head"><p class="eyebrow">Draft</p><h1>Privacy</h1></div>
  <div class="prose">
    ${draftBanner}
    <h2>This website</h2>
    <p>No cookies, no analytics, no ad or tracking scripts. If you join the beta list we store your email address, whether you asked for updates, and the date. We use it to invite you to the beta and, if you asked, to send updates. To have it deleted, email <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
    <p>The Download page asks GitHub for the latest release details from your browser. GitHub sees that request under its own privacy policy.</p>
    <h2>The Playpen app</h2>
    <p>Projects, chats and settings stay on your computer. Playpen has no servers of its own. When you choose to use Claude, your requests go to Claude, under Anthropic’s terms and privacy policy. The app doesn’t send usage analytics today.</p>
    <h2>Children</h2>
    <p>Playpen’s Child Lock lets a parent decide what can be made and when, and can keep everything on the computer. See the For parents page.</p>
    <h2>Contact</h2>
    <p><a href="mailto:${CONTACT}">${CONTACT}</a></p>
  </div>
</div>`
});

/* ---------------------------------------------------------------- 404 */
add({
  file: '404.html', depth: 0, noindex: true, og: false, canonical: '404.html',
  title: 'Page not found | Playpen',
  description: 'That page is not here.',
  body: `
<div class="wrap">
  <div class="page-head">
    <p class="eyebrow">404</p>
    <h1>That page isn’t here.</h1>
    <p class="lede">It may have moved, or the link may be off by a letter.</p>
    <div class="btn-row"><a class="btn primary" href="/">Go to the home page</a><a class="btn" href="/download/">Download Playpen</a></div>
  </div>
</div>`
});

/* ---------------------------------------------------------------- write */
pages.forEach((p) => {
  const out = path.join(ROOT, p.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, layout(p));
});

/* the placeholder game page is its own small document (no site header) */
const game = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sample game (placeholder) | Playpen</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#08090c">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'self'; object-src 'none'">
<link rel="icon" type="image/svg+xml" href="../../img/favicon.svg">
<link rel="stylesheet" href="../../css/site.css">
</head>
<body class="game-page">
<!-- PLACEHOLDER. Replace this whole folder (play/maze/) with a real Playpen-built HTML5 export; see play/README.md. -->
<header><a class="brand" href="../../"><img src="../../img/logo-mark.svg" alt="" width="26" height="26"><span>Playpen</span></a><a class="btn" href="../../">Back to playpen.site</a></header>
<p class="game-banner"><b>Placeholder.</b> This stands in for a real game made with Playpen. It only proves that the page, the QR code and touch controls work.</p>
<div class="game-stage"><canvas id="game" width="450" height="450" role="img" aria-label="A small maze. Move the green dot with the arrow buttons, the arrow keys, or by swiping."></canvas></div>
<div class="dpad" role="group" aria-label="Controls">
  <button type="button" class="up" data-d="-1,0" aria-label="Up">&uarr;</button>
  <button type="button" class="left" data-d="0,-1" aria-label="Left">&larr;</button>
  <button type="button" class="down" data-d="1,0" aria-label="Down">&darr;</button>
  <button type="button" class="right" data-d="0,1" aria-label="Right">&rarr;</button>
</div>
<script src="../../js/play.js" defer></script>
</body>
</html>
`;
fs.mkdirSync(path.join(ROOT, 'play', 'maze'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'play', 'maze', 'index.html'), game);

/* sitemap: indexable pages only (the drafts are noindex and left out) */
const indexable = pages.filter((p) => !p.noindex).map((p) => '/' + p.file.replace(/index\.html$/, ''));
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  indexable.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n') + `\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /terms/\nDisallow: /privacy/\nDisallow: /play/\n\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(ROOT, 'CNAME'), 'playpen.site\n');
fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
console.log('built', pages.length + 1, 'pages');
