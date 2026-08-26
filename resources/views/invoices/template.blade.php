<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Factuur {{ $invoiceNumber }}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #333;
      margin: 0;
      padding: 40px;
      background-color: #f9f9f9;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
      border: 1px solid #eee;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #5b21b6;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo-area h1 {
      margin: 0;
      color: #5b21b6;
      font-size: 28px;
      font-weight: 800;
    }
    .logo-area p {
      margin: 4px 0 0 0;
      color: #666;
      font-size: 14px;
    }
    .invoice-details {
      text-align: right;
    }
    .invoice-details h2 {
      margin: 0;
      color: #333;
      font-size: 22px;
    }
    .invoice-details p {
      margin: 4px 0;
      font-size: 13px;
      color: #666;
    }
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      gap: 20px;
    }
    .address-box {
      flex: 1;
    }
    .address-box h3 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #999;
    }
    .address-box p {
      margin: 4px 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .table th {
      background-color: #f5f3ff;
      color: #5b21b6;
      text-align: left;
      padding: 12px;
      font-size: 13px;
      font-weight: 700;
      border-bottom: 2px solid #ddd;
    }
    .table td {
      padding: 12px;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
    }
    .totals-table {
      width: 300px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 8px 12px;
      font-size: 14px;
    }
    .totals-table tr.grand-total td {
      font-size: 18px;
      font-weight: 800;
      color: #5b21b6;
      border-top: 2px solid #5b21b6;
      padding-top: 12px;
    }
    .footer {
      margin-top: 60px;
      text-align: center;
      font-size: 12px;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div class="logo-area">
        <h1>Saleswizard</h1>
        <p>Your Growth Partner</p>
      </div>
      <div class="invoice-details">
        <h2>FACTUUR</h2>
        <p><strong>Factuurnummer:</strong> {{ $invoiceNumber }}</p>
        <p><strong>Datum:</strong> {{ $date }}</p>
      </div>
    </div>

    <div class="addresses">
      <div class="address-box">
        <h3>Van</h3>
        <p><strong>Saleswizard B.V.</strong></p>
        <p>Deventerstraat 12</p>
        <p>7311 AN Apeldoorn</p>
        <p>Nederland</p>
        <p>KVK: 12345678 | BTW: NL827364526B01</p>
      </div>
      <div class="address-box">
        <h3>Factureren aan</h3>
        <p><strong>{{ $companyName }}</strong></p>
        <p>t.a.v. {{ $userName }}</p>
        <p>Email: {{ $email }}</p>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Omschrijving</th>
          <th style="text-align: right;">Prijs</th>
          <th style="text-align: right;">Aantal</th>
          <th style="text-align: right;">Totaal</th>
        </tr>
      </thead>
      <tbody>
        @if($isFirstInvoice)
        <tr>
          <td><strong>Opstartkosten GEO-Campagne</strong><br><small>Eenmalige set-up, nulmeting, audit en onboarding</small></td>
          <td style="text-align: right;">€ 750,00</td>
          <td style="text-align: right;">1</td>
          <td style="text-align: right;">€ 750,00</td>
        </tr>
        @endif
        <tr>
          <td><strong>{{ $packageName }} Abonnement</strong><br><small>AI zoekmachine-vindbaarheid & wekelijkse optimalisatie</small></td>
          <td style="text-align: right;">€ {{ number_format($packagePrice, 2, ',', '.') }}</td>
          <td style="text-align: right;">1</td>
          <td style="text-align: right;">€ {{ number_format($packagePrice, 2, ',', '.') }}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-table">
        <tr>
          <td>Subtotaal (excl. BTW)</td>
          <td style="text-align: right;">€ {{ number_format($subtotal, 2, ',', '.') }}</td>
        </tr>
        <tr>
          <td>BTW (21%)</td>
          <td style="text-align: right;">€ {{ number_format($vat, 2, ',', '.') }}</td>
        </tr>
        <tr class="grand-total">
          <td>Totaal te betalen</td>
          <td style="text-align: right;">€ {{ number_format($total, 2, ',', '.') }}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>Betalingen verlopen automatisch via Mollie recurring direct debit.</p>
      <p>Vragen over uw factuur? Neem contact op via finance@saleswizard.nl</p>
    </div>
  </div>
</body>
</html>
