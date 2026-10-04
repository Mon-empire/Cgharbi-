<#
  Digitale Académie : génération du bloc HTML à partir des contenus.

  Usage (PowerShell Windows, aucune installation requise) :
    powershell -ExecutionPolicy Bypass -File build\build.ps1

  Produit :
    wordpress\digitale-academie-experience\bloc.html          version publique (entrées CONFIRMEE seulement)
    wordpress\digitale-academie-experience\bloc-recette.html  version de relecture (tout, avec badges de statut)
    wordpress\digitale-academie-experience\assets\            CSS, JS, images (copiés depuis src\ et assets\)
    dev\index.html, dev\recette.html                           pages de test dans une réplique du gabarit municipal
    build\rapport.txt                                          ce qui est exclu, ce qui manque avant publication
#>
$ErrorActionPreference = 'Stop'
$Root    = Split-Path $PSScriptRoot -Parent
$Content = Join-Path $Root 'content'
$Plugin  = Join-Path $Root 'wordpress\digitale-academie-experience'
$Version = '1.0.0'
$Today   = Get-Date -Format 'yyyy-MM-dd'

function Read-Json($name) { Get-Content -Raw -Encoding UTF8 (Join-Path $Content $name) | ConvertFrom-Json }
$S  = Read-Json 'sources.json'
$A  = Read-Json 'academie.json'
$F  = Read-Json 'formations.json'
$J  = Read-Json 'journey.json'
$C  = Read-Json 'campus.json'
$T  = Read-Json 'team.json'
$K  = Read-Json 'contact.json'

$StatusLabel = @{ 'CONFIRMEE'='confirmé'; 'A_VALIDER'='à valider'; 'A_ACTUALISER'='à actualiser'; 'OBSOLETE'='obsolète' }
$script:Report = New-Object System.Collections.Generic.List[string]
$script:Recette = $false

function E($s) { if ($null -eq $s) { return '' } [System.Net.WebUtility]::HtmlEncode([string]$s) }
function Ok($e, $label) {
  if ($null -eq $e) { return $false }
  $ok = ($e.status -eq 'CONFIRMEE')
  if (-not $script:Recette) {
    if (-not $ok) { $script:Report.Add("EXCLU    [$($e.status)] $label") }
    elseif (-not $e.validatedBy -and ($e.PSObject.Properties.Name -contains 'validatedBy')) { $script:Report.Add("A SIGNER [CONFIRMEE] $label (validatedBy vide)") }
    if ($ok -and $e.reviewBy -and ($e.reviewBy -lt $Today)) { $script:Report.Add("PERIME   $label (reviewBy $($e.reviewBy))"); return $false }
  }
  return ($script:Recette -or $ok)
}
function MediaOk($key) {
  $m = $C.media.$key
  if ($null -eq $m) { return $false }
  $ok = ($m.status -eq 'CONFIRMEE' -and $m.rights -eq 'CONFIRMEE')
  if (-not $script:Recette -and -not $ok) { $script:Report.Add("EXCLU    [droits $($m.rights)] photo $($m.file)") }
  return ($script:Recette -or $ok)
}
function Badge($e) {
  if (-not $script:Recette -or $null -eq $e) { return '' }
  $st = [string]$e.status
  $titles = @(); foreach ($id in @($e.sources)) { if ($id -and $S.$id) { $titles += $S.$id.title } }
  $tip = if ($titles.Count) { 'Sources : ' + ($titles -join ' ; ') } else { 'Aucune source' }
  if ($e.note) { $tip += ' · ' + $e.note }
  $cls = if ($st -eq 'CONFIRMEE') { 'da-badge da-badge--ok' } else { 'da-badge' }
  return " <span class=`"$cls`" title=`"$(E $tip)`">$(E $StatusLabel[$st])</span>"
}
function Img($key, $cls, $loading) {
  $m = $C.media.$key
  $rb = ''
  if ($script:Recette -and $m.rights -ne 'CONFIRMEE') { $rb = ' data-da-rights="a-valider"' }
  return "<img class=`"$cls`" src=`"{{DA_ASSETS}}img/$($m.file)`" width=`"$($m.w)`" height=`"$($m.h)`" alt=`"$(E $m.alt)`" loading=`"$loading`" decoding=`"async`"$rb>"
}

function Build-Bloc([bool]$recette) {
  $script:Recette = $recette
  $nav = New-Object System.Collections.Generic.List[object]
  $out = New-Object System.Text.StringBuilder

  # ---------- S01 Accueil ----------
  $hero = @"
  <section class="da-seq da-hero" id="da-accueil" data-da-seq="hero" data-da-chapter="L'origine" aria-labelledby="da-hero-title">
    <div class="da-stage da-hero__stage">
      $(if (MediaOk 'facadeHiver') { Img 'facadeHiver' 'da-cover da-hero__photo' 'eager' })
      <div class="da-hero__night" aria-hidden="true"></div>
      <svg class="da-trace da-hero__trace" viewBox="0 0 1800 1200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <path d="M160 697 V502 H600 L655 532 H968 L1022 468 H1485 V690"/>
        <path d="M160 697 H655 M655 700 H968 M968 690 H1485"/>
        <path d="M197 690 V568 H320 V690 M428 690 V560 H553 V690 M685 680 V582 H782 V680"/>
        <path d="M850 680 V572 H945 V680 M897 572 V680"/>
        <path d="M1068 690 V537 H1213 V690 M1335 690 V540 H1440 V690"/>
        <path d="M748 375 V208 H998 V375 Z M780 375 V530 M1045 380 V530"/>
        <path d="M443 505 V310 H592 V505"/>
        <path d="M1490 770 V372 L1640 365 V770"/>
        <path d="M40 1200 L660 703 M1250 1200 L925 700"/>
        <path class="da-fil" d="M645 1200 L897 700"/>
      </svg>
      <div class="da-veil" aria-hidden="true"></div>
      <div class="da-hero__text">
        <p class="da-kicker">$(E $A.city.value) · $(E $A.district.value)$(Badge $A.district)</p>
        <h2 class="da-hero__title" id="da-hero-title"><span class="da-hero__word">Digitale</span> <span class="da-hero__word">Académie</span> <span class="da-hero__city">$(E $A.city.value)</span></h2>
        $(if (Ok $A.tagline 'tagline') { "<p class=`"da-hero__tagline`">$(E $A.tagline.value)$(Badge $A.tagline)</p>" })
        <p class="da-hero__lead">$(if (Ok $A.mission 'mission') { "$(E $A.mission.value)$(Badge $A.mission) " })$(if (Ok $A.offer 'offer') { "$(E $A.offer.value)$(Badge $A.offer)" })</p>
        $(if (Ok $A.audience 'audience') { "<p class=`"da-hero__aud`">$(E $A.audience.value)$(Badge $A.audience)</p>" })
        <div class="da-cta">
          <a class="da-btn da-btn--primary" href="#da-formations">Découvrir les formations</a>
          <a class="da-btn" href="#da-contact">Venir sur place</a>
        </div>
      </div>
      $(if (MediaOk 'facadeHiver') { "<p class=`"da-credit`">Photo : $(E $C.media.facadeHiver.credit)</p>" })
    </div>
  </section>
"@
  [void]$out.Append($hero); $nav.Add(@('da-accueil','Accueil'))

  # ---------- S02 Manifeste ----------
  $h2 = if (Ok $A.manifesto 'manifesto') { "$(E $A.manifesto.value)$(Badge $A.manifesto)" } else { "$(E $A.slogan.value)" }
  $wordStyle = if (MediaOk 'etudiants1') { " style=`"--da-word-img:url('{{DA_ASSETS}}img/$($C.media.etudiants1.file)')`" data-da-img" } else { '' }
  $p1 = @(); if (Ok $A.offer 'offer') { $p1 += "$(E $A.offer.value)$(Badge $A.offer)" }; if (Ok $A.daeu 'daeu') { $p1 += "$(E $A.daeu.value)$(Badge $A.daeu)" }
  $p2 = @(); if (Ok $A.surface 'surface') { $p2 += "$(E $A.surface.value) $(E $A.surface.detail).$(Badge $A.surface)" }; if (Ok $A.coaches 'coaches') { $p2 += "$(E $A.coaches.value) accompagnent les étudiants sur place.$(Badge $A.coaches)" }
  [void]$out.Append(@"
  <section class="da-seq da-manifeste" data-da-seq="manifeste" data-da-chapter="Le manifeste" aria-labelledby="da-man-title">
    <div class="da-stage da-manifeste__stage">
      <p class="da-manifeste__word" aria-hidden="true"$wordStyle><span>Univer</span><span>sité</span></p>
      <p class="da-manifeste__vient" aria-hidden="true">vient à toi</p>
      <div class="da-manifeste__text">
        <h2 class="da-h2" id="da-man-title">$h2</h2>
        $(if ($p1.Count) { "<p>$($p1 -join ' ')</p>" })
        $(if ($p2.Count) { "<p>$($p2 -join ' ')</p>" })
      </div>
    </div>
  </section>
"@)

  # ---------- S03 Formations ----------
  $cats = @($F.categories | Where-Object { Ok $_ ("formation " + $_.label) })
  $levels = @{}; foreach ($l in $F.levels) { $levels[$l.id] = $l.label }
  $li = ($cats | ForEach-Object {
      $cat = $_
      $def = if (Ok $cat.definition ("définition " + $cat.label)) { "<p class=`"da-cat__def`">$(E $cat.definition.value)$(Badge $cat.definition)</p>" } else { '' }
      $note = if ($cat.note -and (Ok $cat.note ("note " + $cat.label))) { "<p class=`"da-cat__note`">$(E $cat.note.value)$(Badge $cat.note)</p>" } else { '' }
      "<li class=`"da-cat`" data-id=`"$($cat.id)`" data-level=`"$($cat.level)`" data-x=`"$($cat.x)`" data-y=`"$($cat.y)`" style=`"--c:$($cat.color)`"><h3 class=`"da-cat__title`">$(E $cat.label)$(Badge $cat)</h3><p class=`"da-cat__level`">$(E $levels[$cat.level])</p>$def$note</li>"
    }) -join "`n          "
  $domains = if (Ok $F.domains 'domaines') { "<div class=`"da-domains`"><p class=`"da-kicker`">Domaines annoncés$(Badge $F.domains)</p><ul>" + (($F.domains.values | ForEach-Object { "<li>$(E $_)</li>" }) -join '') + "</ul></div>" } else { '' }
  $levelsJson = ($F.levels | ForEach-Object { '{"id":"' + $_.id + '","label":"' + $_.label + '"}' }) -join ','
  [void]$out.Append(@"
  <section class="da-seq da-formations" id="da-formations" data-da-seq="formations" data-da-chapter="Le choix" aria-labelledby="da-f-title">
    <div class="da-wrap">
      <p class="da-kicker">Le choix</p>
      <h2 class="da-h2" id="da-f-title">Ton parcours, du DAEU au Master</h2>
      <p class="da-lead">Les catégories de diplômes ci-dessous sont proposées à la Digitale Académie. La liste détaillée des formations est en cours de validation.</p>
      <div class="da-explorer" data-da-explorer data-levels='[$levelsJson]'>
        <ul class="da-cats" aria-label="Catégories de diplômes">
          $li
        </ul>
        $domains
      </div>
    </div>
  </section>
"@)
  $nav.Add(@('da-formations','Formations'))

  # ---------- S04 Parcours ----------
  $steps = @($J.steps | Where-Object { Ok $_ ("étape " + $_.title) })
  if ($steps.Count) {
    $n = $steps.Count; $i = 0
    $stepsHtml = ($steps | ForEach-Object { $i++; "<li class=`"da-step`"><span class=`"da-step__num`">$('{0:D2}' -f $i) / $('{0:D2}' -f $n)</span><h3 class=`"da-step__title`">$(E $_.title)</h3><p>$(E $_.text)$(Badge $_)</p></li>" }) -join "`n          "
    [void]$out.Append(@"
  <section class="da-seq da-walk" id="da-parcours" data-da-seq="walk" data-da-chapter="Le parcours" aria-labelledby="da-j-title">
    <div class="da-stage da-walk__stage">
      $(if (MediaOk 'facadeHiver') { "<div class=`"da-walk__cam`" aria-hidden=`"true`">" + (Img 'facadeHiver' 'da-cover' 'lazy').Replace('alt="' + (E $C.media.facadeHiver.alt) + '"','alt=""') + "<svg viewBox=`"0 0 1800 1200`" preserveAspectRatio=`"xMidYMid slice`" focusable=`"false`"><path class=`"da-fil`" d=`"M645 1200 L897 700`"/><g class=`"da-bornes`"></g></svg></div><div class=`"da-walk__tint`" aria-hidden=`"true`"></div>" })
      <div class="da-walk__head">
        <p class="da-kicker">Le parcours · l'allée de la rue Honoré de Balzac</p>
        <h2 class="da-h2" id="da-j-title">Jusqu'à la porte, étape par étape</h2>
      </div>
      <ol class="da-steps">
          $stepsHtml
      </ol>
    </div>
  </section>
"@)
    $nav.Add(@('da-parcours','Parcours'))
  }

  # ---------- S05 Campus ----------
  if (MediaOk 'facade2023') {
    $facts = @()
    if (Ok $A.surface 'surface') { $facts += "<p>$(E (($A.surface.detail).Substring(0,1).ToUpper() + ($A.surface.detail).Substring(1)))$(Badge $A.surface)</p>" }
    if (Ok $C.spaces 'espaces') { $facts += "<p>$(E $C.spaces.value)$(Badge $C.spaces)</p>" }
    [void]$out.Append(@"
  <section class="da-seq da-campus" id="da-campus" data-da-seq="campus" data-da-chapter="Le lieu" aria-labelledby="da-c-title">
    <div class="da-stage da-campus__stage">
      <div class="da-campus__head">
        <p class="da-kicker">Le campus</p>
        <h2 class="da-h2 da-campus__title" id="da-c-title">Ici, tout commence.</h2>
      </div>
      <figure class="da-campus__fig">
        <div class="da-campus__frame">
          $(Img 'facade2023' 'da-cover da-campus__photo' 'lazy')
          <svg class="da-trace da-campus__trace" viewBox="0 0 1800 1200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            <rect class="da-campus__volet" x="900" y="0" width="0" height="1200"/>
            <g class="da-campus__lines">
              <path d="M0 262 H462 L712 338 H1275 L1510 62 H1800"/>
              <path d="M0 672 H612 L712 612 H1275"/>
              <path d="M120 660 V382 H368 V660 Z M487 650 V395 H583 V650 Z M633 612 V412 H692 V612 Z"/>
              <path d="M765 612 V428 H940 V612 Z"/>
              <path d="M1053 615 V415 H1225 V615 Z M1139 415 V615"/>
              <path d="M1410 560 V330 H1460 V560 M1652 520 V292 H1800"/>
              <path d="M1012 330 V42 H1290 V190 M705 215 V150 H830 V215"/>
              <path d="M1037 422 A40 40 0 1 1 957 422 A40 40 0 1 1 1037 422"/>
            </g>
          </svg>
        </div>
        <figcaption>Photo : $(E $C.media.facade2023.credit)</figcaption>
      </figure>
      <div class="da-campus__figs">
        $(if (Ok $A.surface 'surface') { "<p class=`"da-big`">$(E $A.surface.value)</p>" })
        <div class="da-campus__facts">
          <ul class="da-words">$(($C.words | ForEach-Object { "<li>$(E $_)</li>" }) -join '')</ul>
          $($facts -join "`n          ")
        </div>
      </div>
    </div>
  </section>
"@)
    $nav.Add(@('da-campus','Campus'))
  }

  # ---------- S06 Visite ----------
  $rooms = @($C.rooms | Where-Object { (Ok $_ ("salle " + $_.title)) -and (MediaOk $_.media) })
  if ($rooms.Count) {
    $roomsHtml = ($rooms | ForEach-Object {
        $m = $C.media.($_.media); $shape = if ($m.h -gt $m.w) { 'tall' } else { 'wide' }
        "<li class=`"da-room da-room--$shape`">$(Img $_.media 'da-room__img' 'lazy')<p><strong>$(E $_.title)</strong><br>$(E $_.text)$(Badge $_)</p></li>"
      }) -join "`n        "
    [void]$out.Append(@"
  <section class="da-seq da-visit" id="da-visite" data-da-seq="visit" data-da-chapter="La visite" aria-labelledby="da-v-title">
    <div class="da-stage da-visit__stage">
      <div class="da-visit__head">
        <p class="da-kicker">La visite</p>
        <h2 class="da-h2" id="da-v-title">Chaque salle a sa figure</h2>
      </div>
      <ul class="da-visit__track" aria-label="Salles et espaces">
        $roomsHtml
      </ul>
    </div>
  </section>
"@)
  }

  # ---------- S07 Accompagnement ----------
  $sup = @($T.support | Where-Object { Ok $_ ("accompagnement " + $_.title) })
  if ($sup.Count) {
    $dl = ($sup | ForEach-Object { "<div><dt>$(E $_.title)</dt><dd>$(E $_.text)$(Badge $_)</dd></div>" }) -join "`n          "
    $photo = if (MediaOk $T.photo) { "<figure class=`"da-human__photo`">$(Img $T.photo 'da-human__img' 'lazy')</figure>" } else { '' }
    [void]$out.Append(@"
  <section class="da-seq da-human$(if (-not $photo) { ' da-human--text' })" id="da-accompagnement" data-da-seq="human" data-da-chapter="L'accompagnement" aria-labelledby="da-h-title">
    <div class="da-human__grid">
      $photo
      <div class="da-human__body">
        <p class="da-kicker">L'accompagnement</p>
        <h2 class="da-human__title" id="da-h-title">Tu n'étudies <strong>pas seul.</strong></h2>
        <dl class="da-human__list">
          $dl
        </dl>
      </div>
    </div>
  </section>
"@)
    $nav.Add(@('da-accompagnement','Accompagnement'))
  }

  # ---------- S08 Ateliers ----------
  if (Ok $T.workshops 'ateliers') {
    $ws = ($T.workshops.items | ForEach-Object { "<li class=`"da-ws__item`"><span class=`"da-ws__name`">$(E $_.title)</span>$(if ($_.text) { '<span class="da-ws__text">' + (E $_.text) + '</span>' })</li>" }) -join ''
    [void]$out.Append(@"
  <section class="da-seq da-ws" data-da-seq="workshops" data-da-chapter="Les ateliers" aria-labelledby="da-w-title">
    <div class="da-ws__inner">
      <p class="da-kicker">Les ateliers$(Badge $T.workshops)</p>
      <h2 class="da-h2" id="da-w-title">Des ateliers pour tenir le rythme</h2>
      <ul class="da-ws__list">$ws</ul>
    </div>
  </section>
"@)
  }

  # ---------- S09 Territoire / contact ----------
  $hours = if (Ok $K.hours 'horaires') { "<div><dt>Horaires</dt><dd>$(($K.hours.value | ForEach-Object { E $_ }) -join '<br>')$(Badge $K.hours)</dd></div>" } else { '' }
  [void]$out.Append(@"
  <section class="da-seq da-terr" id="da-contact" data-da-seq="territory" data-da-chapter="Le territoire" aria-labelledby="da-t-title">
    <div class="da-terr__grid">
      <div class="da-terr__map" aria-hidden="true">
        <svg viewBox="0 0 600 600" focusable="false">
          <path class="da-terr__river" d="M-20 140 C 160 180, 240 260, 300 330"/>
          <path class="da-terr__river" d="M620 120 C 460 200, 360 270, 300 330"/>
          <path class="da-terr__river da-terr__river--out" d="M300 330 C 260 420, 220 520, 180 640"/>
          <circle class="da-terr__dot" cx="300" cy="330" r="7"/>
          <circle class="da-terr__ring" cx="300" cy="330" r="22"/>
        </svg>
        <p class="da-terr__schema">Schéma non cartographique</p>
      </div>
      <div class="da-terr__body">
        <p class="da-kicker">$(E $A.city.value)</p>
        <h2 class="da-h2" id="da-t-title">Venir à la Digitale Académie</h2>
        $(if (Ok $K.confluence 'confluence') { "<p class=`"da-terr__lead`">$(E $K.confluence.value)$(Badge $K.confluence)</p>" })
        <dl class="da-terr__list">
          $(if (Ok $K.address 'adresse') { "<div><dt>Adresse</dt><dd>$(E $K.address.value)$(Badge $K.address)</dd></div>" })
          $hours
          $(if (Ok $K.phone 'téléphone') { "<div><dt>Téléphone</dt><dd><a href=`"tel:$($K.phone.tel)`">$(E $K.phone.value)</a>$(Badge $K.phone)</dd></div>" })
          $(if (Ok $K.email 'e-mail') { "<div><dt>E-mail</dt><dd><a href=`"mailto:$($K.email.value)`">$(E $K.email.value)</a>$(Badge $K.email)</dd></div>" })
          $(if (Ok $K.upt 'UPT') { "<div><dt>$(E $K.upt.label)</dt><dd><a href=`"mailto:$($K.upt.value)`">$(E $K.upt.value)</a>$(Badge $K.upt)</dd></div>" })
        </dl>
        $(if (Ok $K.itinerary 'itinéraire') { "<p><a class=`"da-btn da-btn--primary`" href=`"$($K.itinerary.value)`" target=`"_blank`" rel=`"noopener`">Itinéraire<span class=`"da-sr`"> (nouvel onglet)</span></a> <span class=`"da-coords`">$(E $K.coords.value)</span></p>" })
      </div>
    </div>
  </section>
"@)
  $nav.Add(@('da-contact','Contact'))

  # ---------- S10 Finale ----------
  $fin = if (Ok $K.finale 'finale') { (($K.finale.lines | ForEach-Object { "<span>$(E $_)</span>" }) -join ' ') + (Badge $K.finale) } else { E $A.tagline.value }
  [void]$out.Append(@"
  <section class="da-seq da-finale" data-da-seq="finale" data-da-chapter="L'avenir" aria-labelledby="da-fin-title">
    <div class="da-finale__inner">
      <h2 class="da-finale__title" id="da-fin-title">$fin</h2>
      <div class="da-cta da-cta--center">
        <a class="da-btn da-btn--primary" href="#da-formations">Découvrir les formations</a>
        <a class="da-btn" href="#da-contact">Prendre contact</a>
        $(if (Ok $K.itinerary 'itinéraire') { "<a class=`"da-btn`" href=`"$($K.itinerary.value)`" target=`"_blank`" rel=`"noopener`">Venir sur place<span class=`"da-sr`"> (nouvel onglet)</span></a>" })
      </div>
    </div>
    <div class="da-exit" aria-hidden="true"></div>
  </section>
"@)

  # ---------- navigation + enveloppe ----------
  $navHtml = ''
  for ($k = 0; $k -lt $nav.Count; $k++) {
    $navHtml += '<li><a class="da-nav__link" href="#' + $nav[$k][0] + '"><span class="da-nav__num">' + ('{0:D2}' -f ($k + 1)) + '</span> ' + $nav[$k][1] + '</a></li>'
  }
  $recetteAttr = if ($recette) { ' data-da-recette' } else { '' }
  $banner = if ($recette) { "<p class=`"da-recette`">Version de relecture : chaque information porte son statut. Les entrées non confirmées n'apparaissent pas dans la version publique.</p>" } else { '' }
  return @"
<div class="da-experience" id="da-experience" data-da-version="$Version" data-da-assets="{{DA_ASSETS}}" data-da-vendor="{{DA_VENDOR}}"$recetteAttr>
  $banner
  <a class="da-skip" href="#da-formations">Passer l'introduction</a>
  <nav class="da-nav" aria-label="Navigation de la Digitale Académie">
    <ol class="da-nav__list">$navHtml</ol>
    <div class="da-nav__tools" hidden>
      <button type="button" class="da-nav__btn da-nav__btn--sound" data-da-action="sound" aria-pressed="true" hidden>Son</button>
      <button type="button" class="da-nav__btn" data-da-action="pause" aria-pressed="false">Mettre en pause les animations</button>
      <button type="button" class="da-nav__btn" data-da-action="motion" aria-pressed="false">Animations réduites</button>
    </div>
  </nav>
$($out.ToString())
</div>
"@
}

# ---------- génération ----------
$utf8 = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force $Plugin, (Join-Path $Plugin 'assets'), (Join-Path $Root 'dev') | Out-Null
$prod = Build-Bloc $false
$rapport = @($script:Report | Sort-Object -Unique)
$rec  = Build-Bloc $true
[System.IO.File]::WriteAllText((Join-Path $Plugin 'bloc.html'), $prod, $utf8)
[System.IO.File]::WriteAllText((Join-Path $Plugin 'bloc-recette.html'), $rec, $utf8)

# copie des fichiers servis par le plugin
foreach ($d in 'css','js','img','audio') { $t = Join-Path $Plugin "assets\$d"; if (Test-Path $t) { Remove-Item -Recurse -Force $t } }
# son (ElevenLabs) : la version A de la musique reste dans le projet, non livrée (la version livrée a été vérifiée sans voix)
New-Item -ItemType Directory -Force (Join-Path $Plugin 'assets\audio') | Out-Null
Get-ChildItem (Join-Path $Root 'assets\audio') -Filter *.mp3 | Where-Object { $_.Name -ne 'musique-a.mp3' } | Copy-Item -Destination (Join-Path $Plugin 'assets\audio')
Copy-Item -Recurse (Join-Path $Root 'src\css') (Join-Path $Plugin 'assets\css')
Copy-Item -Recurse (Join-Path $Root 'src\js')  (Join-Path $Plugin 'assets\js')
Copy-Item -Recurse (Join-Path $Root 'assets\img') (Join-Path $Plugin 'assets\img')

# pages de test : réplique du gabarit municipal (feuille de style réelle du portail)
$tpl = [System.IO.File]::ReadAllText((Join-Path $Root 'dev\gabarit.html'), $utf8)
foreach ($pair in @(@('index.html', $prod), @('recette.html', $rec))) {
  $bloc = $pair[1].Replace('{{DA_ASSETS}}', '/wordpress/digitale-academie-experience/assets/').Replace('{{DA_VENDOR}}', 'https://cdn.jsdelivr.net/npm/')
  $html = $tpl.Replace('<!--DA_BLOC-->', $bloc).Replace('{{DA_ASSETS}}', '/wordpress/digitale-academie-experience/assets/')
  [System.IO.File]::WriteAllText((Join-Path $Root ('dev\' + $pair[0])), $html, $utf8)
}

# page de démonstration (publiée en Artifact) : version de relecture, fichiers servis à côté sous assets/
$demoTpl = [System.IO.File]::ReadAllText((Join-Path $Root 'dev\demo.html'), $utf8)
$demoBloc = $rec.Replace('{{DA_ASSETS}}', 'assets/').Replace('{{DA_VENDOR}}', 'https://cdn.jsdelivr.net/npm/')
New-Item -ItemType Directory -Force (Join-Path $Root 'demo') | Out-Null
[System.IO.File]::WriteAllText((Join-Path $Root 'demo\index.html'), $demoTpl.Replace('<!--DA_BLOC-->', $demoBloc).Replace('{{DA_ASSETS}}', 'assets/'), $utf8)

$head = @("Rapport de génération $Version · $Today", "Version publique : seules les entrées CONFIRMEE sont incluses.", '')
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'rapport.txt'), (($head + $rapport) -join "`r`n"), $utf8)
Write-Output ("OK · bloc.html {0} ko · bloc-recette.html {1} ko · {2} remarques dans build\rapport.txt" -f [math]::Round($prod.Length/1024,1), [math]::Round($rec.Length/1024,1), $rapport.Count)
