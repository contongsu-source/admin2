export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
      return false;
  }
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (let key of keys1) {
      if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}

export function terbilang(nilai: number): string {
  const bilangan = Math.abs(nilai);
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let temp = "";

  if (bilangan < 12) {
    temp = " " + angka[bilangan];
  } else if (bilangan < 20) {
    temp = terbilang(bilangan - 10) + " Belas";
  } else if (bilangan < 100) {
    temp = terbilang(Math.floor(bilangan / 10)) + " Puluh" + terbilang(bilangan % 10);
  } else if (bilangan < 200) {
    temp = " Seratus" + terbilang(bilangan - 100);
  } else if (bilangan < 1000) {
    temp = terbilang(Math.floor(bilangan / 100)) + " Ratus" + terbilang(bilangan % 100);
  } else if (bilangan < 2000) {
    temp = " Seribu" + terbilang(bilangan - 1000);
  } else if (bilangan < 1000000) {
    temp = terbilang(Math.floor(bilangan / 1000)) + " Ribu" + terbilang(bilangan % 1000);
  } else if (bilangan < 1000000000) {
    temp = terbilang(Math.floor(bilangan / 1000000)) + " Juta" + terbilang(bilangan % 1000000);
  } else if (bilangan < 1000000000000) {
    temp = terbilang(Math.floor(bilangan / 1000000000)) + " Milyar" + terbilang(bilangan % 1000000000);
  }

  return temp.trim();
}