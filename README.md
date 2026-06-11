# SysReview Static

GitHub Pages üzerinde doğrudan `index.html` / `index.htm` dosyasıyla çalışan, sunucusuz sistematik alan taraması destek platformu.

## Ne yapar?

- Çoklu PDF yükleme
- PDF metnini tarayıcı içinde çıkarma
- Dahil etme ve hariç tutma kriteri önerme
- Dahil / hariç / belirsiz otomatik ön kodlama
- Manuel karar düzeltme
- Araştırma sorularına göre veri çıkarımı
- Çalışma özellikleri tablosu
- Metin alıntıları yakalama
- Tema frekans grafikleri
- Yıla göre çalışma grafiği
- Dahil/hariç dağılım grafiği
- CSV, JSON ve HTML rapor dışa aktarma

## Nasıl çalıştırılır?

Bu sürüm için `npm install`, `node`, backend, veritabanı veya `.env` dosyası gerekmez.

### GitHub'a yükleme

1. GitHub'da yeni bir repo oluşturun.
2. Bu klasördeki tüm dosyaları repoya yükleyin.
3. Repo ayarlarından **Settings > Pages** bölümüne girin.
4. **Deploy from a branch** seçin.
5. Branch olarak `main`, klasör olarak `/root` seçin.
6. Kaydedin.
7. GitHub Pages adresiniz üzerinden `index.html` veya `index.htm` açılacaktır.

## Klasör yapısı

```text
sysreview-ai-platform-static/
  index.html
  index.htm
  README.md
  .nojekyll
  assets/
    app.js
    styles.css
```

## Önemli not

Bu sürüm tamamen statiktir. PDF dosyaları sunucuya yüklenmez; işlemler kullanıcının tarayıcısında yapılır. Bu nedenle OpenAI API anahtarı veya gizli anahtar kullanılmaz. YZ tabanlı daha güçlü analiz istenirse güvenli bir backend gerekir.

## Sınırlılıklar

- Taranmış/imaj PDF dosyalarında OCR yoktur.
- Bibliyografik alanlar tüm PDF formatlarında kusursuz ayrıştırılamaz.
- Dahil/hariç kararları ön analiz niteliğindedir; nihai sistematik derleme için manuel araştırmacı kontrolü gerekir.
- Büyük PDF setlerinde tarayıcı belleği sınırlayıcı olabilir.
