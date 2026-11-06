# GEO Wizard — Handleiding & Werkwijze

Deze handleiding beschrijft de werking van de GEO Wizard, de definities, en de afspraken voor dagelijks beheer en klantrapportages.

---

## 1. Pakketten, Zoekwoorden & Prompts

Elk project is gekoppeld aan een pakket. Elk ingevoerd zoekwoord genereert automatisch **3 natuurlijke AI-zoekvragen (prompts)** die getest worden in o.a. ChatGPT, Gemini en Perplexity.

| Pakket | Max. Zoekwoorden | Max. Prompts | Frequentie scans |
| :--- | :--- | :--- | :--- |
| **AI/GEO Starter** | 5 zoekwoorden | 15 prompts | Dagelijks (middernacht) |
| **AI/GEO Pro** | 10 zoekwoorden | 30 prompts | Dagelijks (middernacht) |
| **AI/GEO Top** | 20 zoekwoorden | 60 prompts | Dagelijks (middernacht) |

* **Limiet overschrijden:** Het systeem blokkeert automatisch de invoer als er meer zoekwoorden worden opgegeven dan de pakketlimiet toestaat. De gebruiker krijgt direct een waarschuwingsmelding.
* **Upgraden:** Een project kan op elk gewenst moment worden omgezet naar een hoger pakket (of uitgebreid met add-on promptbundels) **zonder dataverlies**. Alle zoekwoorden, nulmetingen en historische scores blijven 100% behouden.

---

## 2. Afspraken over Scannen & Crawlen

### Dagelijkse automatische scan
* Het systeem voert **dagelijks automatisch een scan uit** (om middernacht) voor alle actieve projecten.
* Hierbij worden alle zoekwoorden en prompts opnieuw geanalyseerd bij de geconfigureerde AI-engines en worden nieuwe posities en citaties geregistreerd.

### Handmatig scannen: Afspraak & Richtlijn
> [!IMPORTANT]
> **We scannen alleen handmatig opnieuw bij de status 'Mislukt'.**
> 
> * **Waarom niet bij wijzigingen op de website?**  
>   Een aanpassing of optimalisatie op de website van de klant hoeft **niet** direct handmatig gescand te worden. Deze wijziging wordt de volgende dag vanzelf meegenomen in de automatische dagelijkse scan.
> * **Kostenbesparing:**  
>   Elke handmatige scan triggert live API-aanroepen (OpenAI gpt-4o, Google Gemini Flash, Perplexity Sonar, Anthropic Claude Sonnet 5.5 en scraping). Door onnodige handmatige scans te vermijden, voorkomen we onnodige AI-verbruikskosten.
> * **Wanneer wel?**  
>   Uitsluitend wanneer een prompt of zoekwoord door een timeout of tijdelijke API-storing op de status **'Mislukt'** staat.

---

## 3. Nulmeting & Historie

* **Nulmeting:** De allereerste succesvolle scan van een zoekwoord wordt permanent gelabeld als de **Nulmeting**. Deze datum en score blijven altijd het referentiepunt in de grafiek.
* **Voortgangsgrafiek (Trend):** Elke volgende dagelijkse scan voegt een nieuw datapunt toe aan de grafiek. Zo kan de klant direct zien hoe optimalisaties en backlinks de Share of Voice en gemiddelde AI-positie in de loop der tijd verbeteren.

---

## 4. Begrippenlijst

* **Share of Voice (%):**  
  Het percentage AI-zoekmachines dat het merk van de klant actief aanbeveelt in het antwoord. (Bijvoorbeeld: noemen 2 van de 4 modellen het merk, dan is de Share of Voice 50%).
* **AI Positie (#1 – #20):**  
  De gemiddelde plek waarop het bedrijf in de opsomming of tekstuele aanbeveling van het AI-model verschijnt (#1 is de absolute topaanbeveling).
* **Google Rank:**  
  De klassieke positie van het domein in de organische zoekresultaten van Google.
* **Citations / Sources:**  
  De externe bronnen, artikelen, bedrijvengidsen en backlinks die AI-modellen daadwerkelijk citeren als onderbouwing voor hun advies.

---

## 5. Klanttoegang & Rapportage

* **Read-only klantaccounts:**  
  Bij het aanmaken of bewerken van een project kan een wachtwoord worden ingesteld. Klanten loggen in met hun e-mailadres en zien een beveiligde *read-only* weergave van hun eigen project (zonder bewerkrechten of inkoopkosten).
* **CSV / Excel Export:**  
  Via de knop **"Export CSV"** kan op elk gewenst moment een compleet overzicht van de nulmeting, huidige rankings, share of voice en promptresultaten gedownload worden.

