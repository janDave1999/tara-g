export type Province = {
  name: string;
  region: string;
  key: string;
  lat: number;
  lng: number;
};

export const PH_PROVINCES: Province[] = [
  { "name": "Metro Manila", "region": "NCR", "key": "MM", "lat": 14.6000, "lng": 120.9833 },

  { "name": "Abra", "region": "CAR", "key": "ABR", "lat": 17.6167, "lng": 120.7833 },
  { "name": "Apayao", "region": "CAR", "key": "APA", "lat": 18.3000, "lng": 121.2000 },
  { "name": "Benguet", "region": "CAR", "key": "BEN", "lat": 16.5000, "lng": 120.6667 },
  { "name": "Ifugao", "region": "CAR", "key": "IFU", "lat": 16.8333, "lng": 121.1667 }, 
  { "name": "Kalinga", "region": "CAR", "key": "KAL", "lat": 17.4260, "lng": 121.4161 }, 
  { "name": "Mountain Province", "region": "CAR", "key": "MOU", "lat": 17.0000, "lng": 120.9167 },

  { "name": "Ilocos Norte", "region": "I", "key": "ILN", "lat": 18.2500, "lng": 120.7550 },
  { "name": "Ilocos Sur", "region": "I", "key": "ILS", "lat": 17.2000, "lng": 120.5419 },
  { "name": "La Union", "region": "I", "key": "LUN", "lat": 16.5000, "lng": 120.4167 },
  { "name": "Pangasinan", "region": "I", "key": "PAN", "lat": 15.9167, "lng": 120.3333 },

  { "name": "Batanes", "region": "II", "key": "BTN", "lat": 20.4500, "lng": 121.9800 },
  { "name": "Cagayan", "region": "II", "key": "CAG", "lat": 17.7500, "lng": 121.7500 },
  { "name": "Isabela", "region": "II", "key": "ISA", "lat": 16.9000, "lng": 121.7500 },
  { "name": "Nueva Vizcaya", "region": "II", "key": "NUV", "lat": 16.3301, "lng": 121.1710 },
  { "name": "Quirino", "region": "II", "key": "QUI", "lat": 16.2667, "lng": 121.6667 },

  { "name": "Aurora", "region": "III", "key": "AUR", "lat": 15.7300, "lng": 121.5667 },
  { "name": "Bataan", "region": "III", "key": "BAN", "lat": 14.7000, "lng": 120.5333 },
  { "name": "Bulacan", "region": "III", "key": "BUL", "lat": 14.9167, "lng": 120.7833 },
  { "name": "Nueva Ecija", "region": "III", "key": "NUE", "lat": 15.5000, "lng": 120.8667 },
  { "name": "Pampanga", "region": "III", "key": "PAM", "lat": 15.0000, "lng": 120.6500 },
  { "name": "Tarlac", "region": "III", "key": "TAR", "lat": 15.4833, "lng": 120.5833 },
  { "name": "Zambales", "region": "III", "key": "ZMB", "lat": 15.3333, "lng": 119.9833 },

  { "name": "Batangas", "region": "IV-A", "key": "BTG", "lat": 13.7500, "lng": 121.0500 },
  { "name": "Cavite", "region": "IV-A", "key": "CAV", "lat": 14.3333, "lng": 120.8500 },
  { "name": "Laguna", "region": "IV-A", "key": "LAG", "lat": 14.1667, "lng": 121.3833 },
  { "name": "Quezon", "region": "IV-A", "key": "QUE", "lat": 13.9000, "lng": 122.2500 },
  { "name": "Rizal", "region": "IV-A", "key": "RIZ", "lat": 14.6000, "lng": 121.3000 },

  { "name": "Marinduque", "region": "IV-B", "key": "MAD", "lat": 13.4500, "lng": 121.8333 },
  { "name": "Occidental Mindoro", "region": "IV-B", "key": "MDC", "lat": 13.1024, "lng": 120.7651 },
  { "name": "Oriental Mindoro", "region": "IV-B", "key": "MDR", "lat": 13.0565, "lng": 121.4069 },
  { "name": "Palawan", "region": "IV-B", "key": "PLW", "lat": 9.8349, "lng": 118.7384 },
  { "name": "Romblon", "region": "IV-B", "key": "ROM", "lat": 12.5778, "lng": 122.2691 },

  { "name": "Albay", "region": "V", "key": "ALB", "lat": 13.1200, "lng": 123.7500 },
  { "name": "Camarines Norte", "region": "V", "key": "CAN", "lat": 14.1000, "lng": 122.9500 },
  { "name": "Camarines Sur", "region": "V", "key": "CAS", "lat": 13.7000, "lng": 123.3000 },
  { "name": "Catanduanes", "region": "V", "key": "CAT", "lat": 13.7089, "lng": 124.2422 },
  { "name": "Masbate", "region": "V", "key": "MAS", "lat": 12.3667, "lng": 123.6000 },
  { "name": "Sorsogon", "region": "V", "key": "SOR", "lat": 12.9667, "lng": 123.7500 },

  { "name": "Aklan", "region": "VI", "key": "AKL", "lat": 11.6833, "lng": 122.3667 },
  { "name": "Antique", "region": "VI", "key": "ANT", "lat": 10.9833, "lng": 122.0833 },
  { "name": "Capiz", "region": "VI", "key": "CAP", "lat": 11.5500, "lng": 122.7407 },
  { "name": "Guimaras", "region": "VI", "key": "GUI", "lat": 10.4000, "lng": 123.0000 },
  { "name": "Iloilo", "region": "VI", "key": "ILI", "lat": 10.7167, "lng": 122.5667 },
  { "name": "Negros Occidental", "region": "VI", "key": "NEC", "lat": 10.2926, "lng": 123.0247 },

  { "name": "Bohol", "region": "VII", "key": "BOH", "lat": 9.7500, "lng": 124.2500 },
  { "name": "Cebu", "region": "VII", "key": "CEB", "lat": 10.3157, "lng": 123.8854 },
  { "name": "Negros Oriental", "region": "VII", "key": "NER", "lat": 9.6282, "lng": 122.9888 },
  { "name": "Siquijor", "region": "VII", "key": "SIG", "lat": 9.1999, "lng": 123.5952 },

  { "name": "Biliran", "region": "VIII", "key": "BIL", "lat": 11.7000, "lng": 124.5333 },
  { "name": "Eastern Samar", "region": "VIII", "key": "EAS", "lat": 11.5001, "lng": 125.5000 },
  { "name": "Leyte", "region": "VIII", "key": "LEY", "lat": 11.2500, "lng": 124.8333 },
  { "name": "Northern Samar", "region": "VIII", "key": "NSA", "lat": 12.3613, "lng": 124.7741 },
  { "name": "Samar", "region": "VIII", "key": "WSA", "lat": 11.7500, "lng": 125.0000 },
  { "name": "Southern Leyte", "region": "VIII", "key": "SLE", "lat": 10.3333, "lng": 125.0000 },

  { "name": "Zamboanga del Norte", "region": "IX", "key": "ZAN", "lat": 8.5000, "lng": 123.0000 },
  { "name": "Zamboanga del Sur", "region": "IX", "key": "ZAS", "lat": 7.7500, "lng": 122.7500 },
  { "name": "Zamboanga Sibugay", "region": "IX", "key": "ZSI", "lat": 7.5000, "lng": 122.5000 },

  { "name": "Bukidnon", "region": "X", "key": "BUK", "lat": 8.0833, "lng": 124.8333 },
  { "name": "Camiguin", "region": "X", "key": "CAM", "lat": 9.1732, "lng": 124.7299 },
  { "name": "Lanao del Norte", "region": "X", "key": "LAN", "lat": 8.2000, "lng": 124.0000 },
  { "name": "Misamis Occidental", "region": "X", "key": "MSC", "lat": 8.1000, "lng": 123.5000 },
  { "name": "Misamis Oriental", "region": "X", "key": "MSR", "lat": 8.5046, "lng": 124.6220 },

  { "name": "Compostela Valley", "region": "XI", "key": "COM", "lat": 7.5000, "lng": 126.0000 },
  { "name": "Davao del Norte", "region": "XI", "key": "DAV", "lat": 7.5618, "lng": 125.6533 },
  { "name": "Davao del Sur", "region": "XI", "key": "DAS", "lat": 6.7663, "lng": 125.3284 },
  { "name": "Davao Occidental", "region": "XI", "key": "DAC", "lat": 6.0941, "lng": 125.6095 },
  { "name": "Davao Oriental", "region": "XI", "key": "DAO", "lat": 7.3172, "lng": 126.5420 },

  { "name": "Cotabato", "region": "XII", "key": "NCO", "lat": 7.2000, "lng": 124.2500 },
  { "name": "Sarangani", "region": "XII", "key": "SAR", "lat": 5.9267, "lng": 124.9948 },
  { "name": "South Cotabato", "region": "XII", "key": "SCO", "lat": 6.3333, "lng": 124.8000 },
  { "name": "Sultan Kudarat", "region": "XII", "key": "SUK", "lat": 6.5833, "lng": 124.9000 },

  { "name": "Agusan del Norte", "region": "XIII", "key": "AGN", "lat": 9.2500, "lng": 125.5000 },
  { "name": "Agusan del Sur", "region": "XIII", "key": "AGS", "lat": 8.5000, "lng": 125.7500 },
  { "name": "Dinagat Islands", "region": "XIII", "key": "DIN", "lat": 10.0500, "lng": 125.5480 },
  { "name": "Surigao del Norte", "region": "XIII", "key": "SUN", "lat": 9.7500, "lng": 125.5000 },
  { "name": "Surigao del Sur", "region": "XIII", "key": "SUR", "lat": 9.5833, "lng": 126.0000 },

  { "name": "Basilan", "region": "ARMM", "key": "BAS", "lat": 6.7000, "lng": 122.1000 },
  { "name": "Lanao del Sur", "region": "ARMM", "key": "LAS", "lat": 7.7500, "lng": 124.1500 },
  { "name": "Maguindanao", "region": "ARMM", "key": "MAG", "lat": 7.0000, "lng": 124.5000 },
  { "name": "Sulu", "region": "ARMM", "key": "SLU", "lat": 6.2167, "lng": 121.0000 },
  { "name": "Tawi-tawi", "region": "ARMM", "key": "TAW", "lat": 5.0167, "lng": 120.6667 }
]
