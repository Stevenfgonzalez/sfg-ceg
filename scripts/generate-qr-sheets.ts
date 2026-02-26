/**
 * Generate printable QR code sheets for each CEG safe zone.
 *
 * Usage:
 *   npx tsx scripts/generate-qr-sheets.ts
 *
 * Output:
 *   ./qr-sheets/*.html  (open in browser → Cmd+P → Save as PDF)
 *
 * Update INCIDENT_ID before each drill/incident.
 */

import QRCode from 'qrcode';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ─── CONFIGURATION ───────────────────────────────────────────────
const BASE_URL = 'https://ceg.sfg.ac';

// Update this before each drill / real incident
const INCIDENT_ID = 'PASTE-YOUR-INCIDENT-UUID-HERE';

// T1 — Topanga Canyon Safe Zones
const SAFE_ZONES = [
  {
    name: 'Calabasas High School',
    address: '22855 Mulholland Hwy, Calabasas',
    zone: 'T1',
  },
  {
    name: 'Agoura High School',
    address: '28545 Driver Ave, Agoura Hills',
    zone: 'T1',
  },
  {
    name: 'Woodland Hills Rec Center',
    address: '5858 Shoup Ave, Woodland Hills',
    zone: 'T1',
  },
  {
    name: 'Agoura Hills Rec Center',
    address: '29900 Ladyface Ct, Agoura Hills',
    zone: 'T1',
  },
  {
    name: 'Topanga Community House',
    address: '1440 N Topanga Canyon Blvd',
    zone: 'T1',
  },
  {
    name: 'Pierce College Equestrian',
    address: '6201 Winnetka Ave, Woodland Hills',
    zone: 'T1',
  },
  {
    name: 'Hansen Dam Equestrian',
    address: '11127 Orcas Ave, Lake View Terrace',
    zone: 'T1',
  },
];
// ─────────────────────────────────────────────────────────────────

const OUTPUT_DIR = join(process.cwd(), 'qr-sheets');

async function generate() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const sz of SAFE_ZONES) {
    const checkinUrl = `${BASE_URL}/checkin?incident=${INCIDENT_ID}&ap=${encodeURIComponent(sz.name)}`;

    const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
      width: 800,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CEG Check-In — ${sz.name}</title>
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 0.5in;
      text-align: center;
    }
    .brand {
      font-size: 14pt;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .header {
      font-size: 28pt;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #dc2626;
      margin-bottom: 12px;
    }
    .zone-badge {
      display: inline-block;
      background: #0f172a;
      color: #fff;
      font-size: 12pt;
      font-weight: 700;
      padding: 4px 16px;
      border-radius: 6px;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .zone-name {
      font-size: 36pt;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .zone-address {
      font-size: 16pt;
      color: #475569;
      margin-bottom: 20px;
    }
    .qr-container {
      border: 4px solid #0f172a;
      border-radius: 16px;
      padding: 12px;
      display: inline-block;
      margin-bottom: 20px;
    }
    .qr-container img {
      width: 4.5in;
      height: 4.5in;
    }
    .instructions {
      font-size: 22pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .instructions-sub {
      font-size: 13pt;
      color: #64748b;
      max-width: 6in;
      line-height: 1.5;
    }
    .footer {
      margin-top: 20px;
      font-size: 9pt;
      color: #94a3b8;
      line-height: 1.4;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="brand">Community Emergency Guide</div>
  <div class="header">EMERGENCY CHECK-IN</div>
  <div class="zone-badge">EVACUATION ZONE ${sz.zone}</div>
  <div class="zone-name">${sz.name}</div>
  <div class="zone-address">${sz.address}</div>

  <div class="qr-container">
    <img src="${qrDataUrl}" alt="QR Code — ${sz.name}" />
  </div>

  <div class="instructions">Scan with your phone camera</div>
  <div class="instructions-sub">
    Select your status: SAFE &middot; SHELTER IN PLACE &middot; NEED EMS<br>
    No app download or account required.
  </div>

  <div class="footer">
    Community Emergency Guide &middot; ceg.sfg.ac<br>
    This sheet is specific to this safe zone. Do not relocate.
  </div>
</body>
</html>`;

    const filename = `${sz.name.replace(/\s+/g, '-')}.html`;
    const filepath = join(OUTPUT_DIR, filename);
    writeFileSync(filepath, html, 'utf-8');
    console.log(`  Created: ${filename}`);
  }

  console.log(`\n${SAFE_ZONES.length} sheets generated in ./qr-sheets/`);
  console.log('\nTo create PDFs:');
  console.log('  1. Open each .html file in Chrome or Safari');
  console.log('  2. Cmd+P → Save as PDF');
  console.log('  3. Print on letter-size paper, laminate for field use');
}

generate().catch(console.error);
