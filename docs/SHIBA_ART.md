# Kanji.pro 3.23 — zatwierdzony motyw Shiba Inu

## Zatwierdzone maskotki

To **sześć osobnych ilustracji z zaakceptowanych zestawów** (nie są odrysowywane ani wycinane z makiety całej aplikacji):

| Ścieżka | Pochodzenie | Miejsce użycia |
| --- | --- | --- |
| `icons/shiba-face.svg` | druga seria: sama głowa bez chustki | logo przeglądarki, nagłówek, podstawowa ikona aplikacji |
| `icons/shiba-paws.svg` | druga seria: głowa z łapkami | na górnym brzegu karty „Gotowy na naukę?” |
| `icons/shiba-dance.svg` | druga seria: tańcząca Shiba | ekran Historia |
| `icons/shiba-study.svg` | pierwsza seria: siedząca z chustką | dolna część bocznego menu |
| `icons/shiba-peek.svg` | pierwsza seria: wyglądająca z chustką | niewielka dekoracja quizu |
| `icons/shiba-cheer.svg` | pierwsza seria: wesoła z chustką | ekran „Dobra robota!” |

Wszystkie maskotki mają transparentne tło i są osadzone w plikach SVG jako pliki WebP w wysokiej rozdzielczości. SVG pełni rolę pojemnika dla oryginalnej ilustracji; nie należy mylić tego z ręcznie odrysowanym wektorem. Ilustracje zostały przycięte jedynie do ich rzeczywistej granicy z niewielkim marginesem.

## Baner

`icons/japan-banner.svg` to osobna lekka ilustracja wektorowa z **Fujisan, czerwoną bramą torii i sakurą**. Jest widoczna na ekranie Nauka w motywie Shiba i nie zasłania przycisków ani formularzy.

## Ikona instalowanej aplikacji na iOS i PWA

Pliki źródłowe `assets/pwa-icons/*.b64` zawierają cztery gotowe PNG głowy z drugiej serii. Skrypt `scripts/install_shiba_pwa_icons.py` w workflow GitHub Actions dekoduje je do `_site/icons/` i zastępuje wcześniejsze ikony bez zmiany ścieżek z manifestu. Wartości sprawdzają wymiary i nagłówek PNG, a testy automatyczne sprawdzają dostępność ikon. Nigdy nie są używane do przechowywania danych użytkownika.

Ikony wcześniej zainstalowanych aplikacji iOS mogą pozostawać w pamięci systemu; **nie usuwaj aplikacji ani danych przeglądarki wyłącznie w celu odświeżenia ikonki**, bo spowoduje to utratę niezsynchonizowanych danych lokalnych.

## Bezpieczeństwo i motyw klasyczny

Wszystkie dekoracje są wyłączone w motywie Klasycznym; nowe pliki są zapisane offline w Service Worker. Nie zmieniono Firebase, RSS, eksportu JSON, obsługi klawiatury iPada ani bazy słówek.
