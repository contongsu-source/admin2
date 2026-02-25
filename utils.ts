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