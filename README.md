# linux-whazzapp

Lekki, nieoficjalny klient WhatsApp Web dla Ubuntu (Electron) w stylu ZapZap,
z własną ikoną, zasobnikiem systemowym i automatycznym motywem jasnym/ciemnym.

Created by: JGu  
Supported by Claude

**Wersja:** 1.2.1 · **Licencja:** MIT · **Platforma:** Ubuntu (GNOME), x86_64

> Projekt nie jest powiązany z WhatsApp ani Meta. Ikona jest własna i nie zawiera
> logo WhatsApp. Aplikacja ładuje oficjalną stronę `web.whatsapp.com`, więc działa
> tak długo, jak działa WhatsApp Web.

## Funkcje

- **Zasobnik systemowy (tray):** zamknięcie okna chowa je do zasobnika, kliknięcie ikony
  pokazuje lub ukrywa okno. Menu: zamykanie do tray, powiadomienia, autostart,
  start zminimalizowany, motyw, przeładuj, zakończ.
- **Powiadomienia systemowe** o nowych wiadomościach (nadawca i treść).
- **Klik w powiadomienie otwiera okno i właściwą rozmowę.**
- **Licznik nieprzeczytanych:** czerwona kropka na ikonie w tray, liczba w tooltipie
  oraz licznik na ikonie w docku (o ile dock go obsługuje).
- **Motyw automatyczny dzień/noc** zgodnie z ustawieniem Ubuntu, z ręcznym wyborem
  w menu tray (Automatyczny / Jasny / Ciemny). Przełączenie w systemie działa na żywo.
- **Ikony zależne od motywu:** ikona w tray i ikona aplikacji (menu, dock, okno)
  mają wariant jasny i ciemny.
- **Ruchomy podział** między listą czatów (lewo) a rozmową (prawo): przeciągnij pionową
  krawędź listy czatów. Szerokość jest zapamiętywana, dwuklik na krawędzi przywraca domyślną.
- **O programie** w menu tray: wersja i podpis autora.
- **Autostart** z systemem (opcjonalnie, ukryty w tray).
- Sprawdzanie pisowni PL/EN, menu kontekstowe, linki otwierane w przeglądarce systemowej.
- Jedna instancja, sesja zapamiętana między uruchomieniami, kamera i mikrofon dla rozmów.

## Instalacja (Ubuntu)

1. Pobierz `linux-whazzapp_1.2.1_amd64.deb`.
2. Zainstaluj (apt dociągnie zależności). Najpierw skopiuj plik do `/tmp`, żeby apt
   nie wypisywał ostrzeżenia o dostępie użytkownika `_apt`:
   ```
   cp ~/Pobrane/linux-whazzapp_1.2.1_amd64.deb /tmp/
   sudo apt install /tmp/linux-whazzapp_1.2.1_amd64.deb
   ```
3. Uruchom: wciśnij Super, wpisz „linux-whazzapp”, albo wpisz `linux-whazzapp` w terminalu.
4. Zaloguj się: w telefonie WhatsApp → Ustawienia → Połączone urządzenia →
   Połącz urządzenie i zeskanuj kod QR.
5. Opcjonalnie: prawy przycisk na ikonie w tray → „Uruchamiaj z systemem”.

### Aktualizacja

Zamknij aplikację (tray → Zakończ albo `pkill linux-whazzapp`) i zainstaluj nowszy plik tą samą
komendą. Nie trzeba odinstalowywać starej wersji, a sesja (kod QR) zostaje.

### Przejście ze starej nazwy (WhazzApp)

Wersje do 1.2.0 nazywały się `whazzapp`. Instalacja `linux-whazzapp` zastępuje starą paczkę
(apt usuwa ją sam), a przy pierwszym uruchomieniu aplikacja przenosi dotychczasową sesję
i ustawienia do `~/.config/linux-whazzapp`, więc nie trzeba ponownie skanować kodu QR.
Stare wpisy autostartu i ikony w katalogu użytkownika są usuwane. Jeśli po aktualizacji
trzeba się zalogować ponownie, stary katalog z danymi mógł mieć inną nazwę niż zakładam
(szukane są `~/.config/whazzapp` i `~/.config/WhazzApp`).

### Odinstalowanie

```
sudo apt remove linux-whazzapp
rm -rf ~/.config/linux-whazzapp
rm -f ~/.local/share/icons/hicolor/512x512/apps/linux-whazzapp.png
rm -f ~/.config/autostart/linux-whazzapp.desktop
```

`rm -rf ~/.config/linux-whazzapp` usuwa też zapamiętane logowanie, a dwie ostatnie linie
sprzątają ikonę podmienianą przez aplikację i wpis autostartu.

## Budowanie ze źródeł

Wymagane: Node.js 18+ i npm.

```
npm install
npm start          # uruchomienie w trybie testowym
npm run dist       # dist/linux-whazzapp_1.2.1_amd64.deb + AppImage
```

Gdy `electron-builder` kończy się błędem `Cannot read properties of null (reading 'channel')`,
a plik `.deb` w `dist/` jest zapisany, to zawiodło tylko generowanie informacji o
aktualizacjach. Sama paczka jest poprawna (`dpkg-deb -I dist/linux-whazzapp_1.2.1_amd64.deb`).

## Motyw i ikony

- Domyślnie motyw podąża za systemem (Ustawienia → Wygląd). Ręcznie: tray → Motyw.
- W samym WhatsApp (Ustawienia → Motyw) ustaw „Domyślny systemu”, inaczej strona
  zignoruje motyw aplikacji.
- Ikona w tray: ciemna dymka z jasnozielonym ptaszkiem na ciemnym panelu, biała dymka
  na jasnym. Przy nieprzeczytanych dochodzi czerwona kropka.
- Ikona aplikacji jest podmieniana w `~/.local/share/icons/hicolor/512x512/apps/linux-whazzapp.png`.
  Menu aplikacji (Activities) potrafi odświeżyć ją dopiero po chwili albo po ponownym
  zalogowaniu.
- Źródła ikon: `assets/icon.svg`, `assets/icon-dark.svg`, `assets/tray-*.svg`.

## Rozwiązywanie problemów

| Objaw | Co zrobić |
|---|---|
| Brak ikony w górnym panelu | `sudo apt install gnome-shell-extension-appindicator`, potem wyloguj się i zaloguj. Bez tego „zamykanie do zasobnika” chowa okno bez łatwego powrotu, więc do czasu naprawy wyłącz tę opcję. |
| Brak powiadomień | Sprawdź tryb „Nie przeszkadzać” w Ubuntu, przełącznik „Powiadomienia” w tray oraz Ustawienia → Powiadomienia w samym WhatsApp. |
| Kliknięcie w powiadomienie tylko pokazuje okno | Otwieranie rozmowy opiera się na strukturze strony WhatsApp Web, którą Meta może zmienić. Zgłoś to, a selektory zostaną poprawione. |
| Nie da się przeciągnąć podziału lista/rozmowa | Krawędź listy czatów podświetla się na zielono po najechaniu myszą. Jeśli jej nie ma, WhatsApp zmienił strukturę strony, a skrypt `assets/resizer.js` wymaga poprawki. Zgłoś to. |
| Brak cyfry na ikonie w docku | Zależy od docka i od powiązania okna z wpisem `.desktop` (`desktopName` jest ustawione). Licznik widać też w tooltipie ikony w tray. |
| Stara ikona w menu aplikacji | Wyloguj się i zaloguj, żeby odświeżyć cache ikon. |
| Strona prosi o aktualizację przeglądarki | Aplikacja podaje się za Chrome o wersji dołączonego silnika. Zaktualizuj linux-whazzapp do nowszej wersji. |

## Ograniczenia

- Licznik nieprzeczytanych bierze się z tytułu strony, np. „(3) WhatsApp”. Zlicza więc
  rozmowy, nie pojedyncze wiadomości, i pomija wyciszone czaty. Tak samo liczy WhatsApp
  w przeglądarce.
- Ikona w tray w standardowym GNOME nie pokazuje cyfry, tylko kropkę.
- Ruchomy podział działa na zasadzie wyszukania lewej kolumny w stronie WhatsApp Web
  (przez `#side`), więc może przestać działać po zmianie układu strony przez Meta.
- Otwieranie rozmowy po kliknięciu w powiadomienie i podmiana ikony aplikacji przy
  zmianie motywu są nowe i mogą wymagać poprawek na różnych wersjach Ubuntu.

## Pliki

```
main.js            logika aplikacji (okno, tray, powiadomienia, motyw, o programie)
assets/            ikony aplikacji i tray (SVG + PNG, warianty jasny/ciemny)
assets/resizer.js  ruchomy podział lista czatów / rozmowa (wstrzykiwany do strony)
build/icon.png     ikona używana przez electron-builder
package.json       metadane i konfiguracja paczki .deb / AppImage
```

Dane użytkownika: `~/.config/linux-whazzapp` (sesja i `settings.json`).

## Historia zmian

- **1.2.1** zmiana nazwy na **linux-whazzapp** (jak reszta serii), migracja sesji ze starej nazwy
- **1.2.0** ruchomy podział lista czatów / rozmowa, „O programie” z podpisem
  „Created by: JGu / Supported by Claude”
- **1.1.5** ikona aplikacji zależna od motywu, klik w powiadomienie otwiera rozmowę
- **1.1.4** ciemny wariant ikony w tray (ciemna dymka)
- **1.1.3** ikona w tray taka sama jak aplikacji, warianty jasny/ciemny
- **1.1.2** usunięta czerwona kropka z ikony aplikacji, `desktopName`
- **1.1.1** zmiana nazwy na WhazzApp
- **1.1.0** automatyczny motyw dzień/noc
- **1.0.0** pierwsza wersja: tray, powiadomienia, autostart

---

Created by: JGu  
Supported by Claude
