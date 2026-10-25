# Virtuelles Systembrett für Systemische Aufstellungen & Coaching

Ein interaktives virtuelles **Systembrett** für Psychotherapeuten, systemische Berater, Coaches und Supervisoren – 100 % lokal und offline im Browser.

## Aussehen

- **Ein ganzes Brett:** Beim Start liegt ein quadratisches Holzbrett mit feiner Maserung auf dem Tisch. Von der gewellten Trennung bleibt nur **eine schmale Naht** sichtbar.
- **Trennen & vereinen:** Über `🔗 1 Brett` oder den Schieberegler (Reiter *Brett*) lassen sich die Hälften auseinanderschieben.
- **Gelaserte Randlinie**, abgerundete Ecken, Holzarten Buche, Eiche, Nussbaum und Slate.
- **3D-Holzobjekte:** In der 3D-Ansicht stehen alle Figuren und Symbole als Körper aus Holz auf dem Brett – Kegelfiguren mit Kugelkopf, gedrechselte Zylinder, Klötze und Kisten, Symbole als dicke ausgesägte Holzplatten auf einem Fuß. Mit Maserung, Lackglanz bei farbigen Figuren, Schlagschatten und aufrechten Beschriftungen. Die aufgemalten Augen der Figuren sitzen am Kopf in Blickrichtung und sind sichtbar, sobald die Figur zum Betrachter schaut. Beim Zoomen bleiben Figuren und Brett immer im selben Größenverhältnis. Export und 2D-Ansicht zeigen weiterhin die Draufsicht.
- **Sechs Figuren mit Augen:** Kegelfiguren in Holz, Rot, Schwarz, Blau, Grün und Weiß. Nur die Figuren haben Augen.
- **Symbole aus Holz (ohne Augen):** Stern, Herz, Diamant, Stein, Blitz, Kiste, Anker, Fragezeichen, Barriere, Licht sowie Holzklötzchen, Zylinder, Baum, Tür (geschlossen), Tür (offen), Dreieck und Kugel. Die Vorschaubilder in der Palette sind dieselbe 3D-Zeichnung wie auf dem Brett.
- **Kordeln & Beziehungen:** rot, naturweiß, schwarz sowie Konflikt, Hinwendung, Austausch, Blockade.

## Funktionen

1. **Bildschirmfüllende Ansicht:** Das Brett wird bei Start, Fenstergröße und Wechsel zwischen *2D Aufsicht* und *3D Perspektive* automatisch eingepasst und zentriert. Der Button ⛶ passt es jederzeit neu ein.
2. **Perspektivenwechsel:** *„Blick aus den Augen dieser Figur“* dreht die Ansicht so, dass die Figur nach oben schaut. Sichtkegel (Blickfeld) und Rückenbereich werden markiert, Figuren im Blick leuchten, Figuren im Rücken werden abgedunkelt. Unten zeigt eine **Ich-Sicht** das Panorama, wie die Figur ihr Gegenüber wahrnimmt (inkl. Augen, wenn jemand zurückschaut). `Esc` beendet.
3. **Menüs:** Links ein Akkordeon (Vorlagen, Figuren, Symbole, Beziehungen, Brett – Vorlagen ist zu Beginn offen). Wird eine Figur angeklickt, überlagert der **Inspektor** das linke Menü; `‹ Werkzeuge` oder `Esc` schließt ihn. Beide Menüs lassen sich einklappen, das rechte (Coach & Notizen) ist beim Start eingeklappt.
4. **Fokus-Modus (`F`):** Vollbild mit eingeklappter rechter Leiste (Notizfelder per Pfeil aufklappbar, ohne Protokoll). Der 2D/3D-Umschalter bleibt in der Kopfzeile. Sobald ein Objekt ausgewählt ist, erscheint der Inspektor als Überlagerung links über dem Brett – das Brett springt dabei nicht. `Esc` schließt zuerst den Inspektor, dann den Fokus-Modus.
5. **Beziehung ziehen:** Kordel wählen, erste Figur anklicken – die Linie folgt dem Mauszeiger und rastet auf der Zielfigur ein. Klick auf die Zielfigur setzt die Beziehung, `Esc` (oder Rechtsklick) bricht ab.
6. **Drag & Drop:** Figuren und Symbole aus der linken Leiste direkt auf das Brett ziehen (ein Klick setzt sie weiterhin in die Mitte).
7. **Phasen & Zeitreise**, **Systemik-Coach** mit zirkulären Fragen, **Vorlagen** (Herkunftsfamilie, Patchwork, Organisation, Inneres Team, Tetralemma, Symptom/Ressource).
8. **Export:** hochauflösendes PNG (2×, **mit Holzmaserung**), `.systembrett`-Sitzungsdatei, druckfertiges Protokoll.

## Mobilgeräte (Handy und Tablet)

Das Systembrett ist für Touch bedienbar. Das Layout folgt den Breakpoints der einbindenden Seite (**900 px** und **600 px**).

- **≤ 900 px (Tablet):** Die Seitenleisten sind Schubladen über dem Brett. Sie sind zu Beginn geschlossen und werden über die Knöpfe „Werkzeuge“ und „Coach & Notizen“ geöffnet. Ein Tipp neben die Schublade schließt sie. Die Kopfzeile zeigt nur Symbole.
- **≤ 600 px (Handy):** Die Kopfzeile hat zwei Reihen (Titel und Aktionen, darunter 2D/3D und Anzeige-Schalter). Der Inspektor erscheint als untere Schublade; die ausgewählte Figur wird automatisch über sie geschoben.
- **Gesten:** Ein Finger verschiebt das Brett oder zieht eine Figur. Zwei Finger zoomen. In 3D drehen zwei Finger das Brett (Verdrehen) und neigen es (gemeinsam hoch/runter).
- **Aus der Palette platzieren:** Antippen setzt das Objekt in die Mitte. Langes Drücken und Ziehen setzt es an die gewünschte Stelle.
- **Beziehungen:** Erste Figur antippen und zur zweiten ziehen oder diese antippen. Ein schwebendes Banner bietet „Abbrechen“.
- **Fokus-Modus** und Export funktionieren ebenfalls; auf Touchgeräten wird die Holzmaserung vorberechnet, damit das Brett flüssig bleibt.

## Start

`index.html` per Doppelklick in einem modernen Browser öffnen (Dateien `index.html`, `app.js`, `style.css` im selben Ordner).

## Bedienung

| Aktion | Steuerung |
| :--- | :--- |
| Figur verschieben | mit der Maus ziehen |
| Figur aus Palette setzen | anklicken oder aufs Brett ziehen |
| Blickrichtung drehen | Knopf am Ring ziehen, `R` / `Shift+R`, `Shift + Mausrad` |
| Figur löschen | `Entf` |
| Brett verschieben | freie Fläche greifen und ziehen (mit sanftem Nachgleiten) |
| Zoom | Mausrad, Pinch-Geste am Trackpad oder +/− – zoomt zum Mauszeiger hin; Doppelklick zoomt hinein |
| 3D: Brett drehen und neigen | rechte Maustaste oder `Strg` + ziehen (links/rechts = drehen, hoch/runter = neigen) |
| 3D: Feinsteuerung | Buttons unten rechts (⟲ ⟳ ⤒ ⤓), `Shift` + Pfeiltasten, `Shift` + Mausrad (Neigung); Kompass setzt die Ansicht zurück |
| Fokus-Modus | `F` oder Button |
| Beziehung / Perspektive / Fokus abbrechen | `Esc` |
