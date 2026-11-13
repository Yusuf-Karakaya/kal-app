// Yemek ve içecek veritabanı.
// Değerler 100 g (içeceklerde 100 ml) başınadır; Türkiye'de yaygın tariflere göre tahmini ortalamalardır
// (TürKomp ve USDA değerleri temel alınarak yuvarlanmıştır). Porsiyonlar tipik ev ölçüleridir.

export interface Food {
  id: string;
  name: string;
  /** Eşleştirmede kullanılan adlar (küçük harf) */
  aliases: string[];
  kcal: number; // 100 g başına
  p: number; // protein (g)
  c: number; // karbonhidrat (g)
  f: number; // yağ (g)
  /** Varsayılan ölçü birimi ve gramı */
  unit: string;
  grams: number;
  /** Diğer ölçüler: birim -> gram */
  units: Record<string, number>;
  /** "yarım ekmek" gibi bütün bir parça (ör. somun) gramı */
  whole?: number;
  /** İçecekse sıvı dengesine katkı oranı (0–1) */
  hydration?: number;
  group: FoodGroup;
}

export type FoodGroup =
  | 'kahvalti' | 'ekmek' | 'corba' | 'ana' | 'et' | 'fastfood' | 'salata'
  | 'meyve' | 'kuruyemis' | 'tatli' | 'icecek' | 'diger';

// [id, ad, ek adlar ("|" ile), kcal, p, c, f, varsayılan birim, gram, diğer birimler ("birim:g,..."), grup, ek]
type Row = [string, string, string, number, number, number, number, string, number, string, FoodGroup, Partial<Food>?];

const ROWS: Row[] = [
  // Kahvaltılık
  ['yumurta', 'Haşlanmış yumurta', 'yumurta|haşlanmış yumurta|rafadan yumurta|kaynamış yumurta|yumurta haşlama', 155, 13, 1.1, 11, 'adet', 50, '', 'kahvalti'],
  ['sahanda-yumurta', 'Sahanda yumurta', 'sahanda yumurta|yağda yumurta|tavada yumurta|göz yumurta', 196, 13.6, 0.8, 15, 'adet', 55, 'porsiyon:110', 'kahvalti'],
  ['omlet', 'Omlet', 'omlet|peynirli omlet|sade omlet', 165, 11, 1, 13, 'porsiyon', 120, '', 'kahvalti'],
  ['menemen', 'Menemen', 'menemen', 110, 6, 5, 8, 'porsiyon', 200, 'tabak:250', 'kahvalti'],
  ['sucuklu-yumurta', 'Sucuklu yumurta', 'sucuklu yumurta', 250, 14, 1, 21, 'porsiyon', 150, '', 'kahvalti'],
  ['beyaz-peynir', 'Beyaz peynir', 'beyaz peynir|peynir|ezine peyniri|tam yağlı beyaz peynir', 264, 17, 1.5, 21, 'dilim', 30, 'kibrit kutusu:30', 'kahvalti'],
  ['light-peynir', 'Light beyaz peynir', 'light peynir|light beyaz peynir|az yağlı peynir', 180, 20, 2, 10, 'dilim', 30, '', 'kahvalti'],
  ['kasar', 'Kaşar peyniri', 'kaşar|kaşar peyniri|eski kaşar', 360, 26, 1.5, 28, 'dilim', 20, '', 'kahvalti'],
  ['lor', 'Lor peyniri', 'lor|lor peyniri', 120, 13, 3, 6, 'yemek kaşığı', 20, 'kase:150', 'kahvalti'],
  ['labne', 'Labne', 'labne|krem peynir', 190, 7, 4, 17, 'yemek kaşığı', 15, '', 'kahvalti'],
  ['tulum', 'Tulum peyniri', 'tulum|tulum peyniri', 360, 24, 1, 29, 'dilim', 30, '', 'kahvalti'],
  ['siyah-zeytin', 'Siyah zeytin', 'zeytin|siyah zeytin|gemlik zeytini|sele zeytin', 190, 1.5, 4, 19, 'adet', 4, 'avuç:40,yemek kaşığı:15', 'kahvalti'],
  ['yesil-zeytin', 'Yeşil zeytin', 'yeşil zeytin|kırma zeytin', 145, 1, 4, 15, 'adet', 5, 'avuç:40', 'kahvalti'],
  ['domates', 'Domates', 'domates|çeri domates', 18, 0.9, 3.9, 0.2, 'adet', 120, 'dilim:20', 'kahvalti'],
  ['salatalik', 'Salatalık', 'salatalık|hıyar', 15, 0.7, 3.6, 0.1, 'adet', 150, 'dilim:15', 'kahvalti'],
  ['biber', 'Yeşil biber', 'biber|yeşil biber|sivri biber|çarliston', 20, 0.9, 4.6, 0.2, 'adet', 30, '', 'kahvalti'],
  ['tereyagi', 'Tereyağı', 'tereyağı|tereyağ', 717, 0.9, 0.1, 81, 'tatlı kaşığı', 5, 'yemek kaşığı:13', 'kahvalti'],
  ['bal', 'Bal', 'bal|süzme bal|petek bal', 304, 0.3, 82, 0, 'tatlı kaşığı', 7, 'yemek kaşığı:20', 'kahvalti'],
  ['recel', 'Reçel', 'reçel|marmelat', 250, 0.4, 62, 0.1, 'tatlı kaşığı', 8, 'yemek kaşığı:20', 'kahvalti'],
  ['pekmez', 'Pekmez', 'pekmez|üzüm pekmezi|dut pekmezi', 293, 0, 73, 0, 'yemek kaşığı', 20, '', 'kahvalti'],
  ['tahin', 'Tahin', 'tahin', 595, 17, 21, 54, 'yemek kaşığı', 15, '', 'kahvalti'],
  ['tahin-pekmez', 'Tahin pekmez', 'tahin pekmez|tahinli pekmez', 450, 8, 45, 27, 'yemek kaşığı', 20, '', 'kahvalti'],
  ['findik-kremasi', 'Fındık kreması', 'fındık kreması|nutella|kakaolu fındık kreması|sarelle', 540, 6, 57, 31, 'tatlı kaşığı', 10, 'yemek kaşığı:20', 'kahvalti'],
  ['fistik-ezmesi', 'Fıstık ezmesi', 'fıstık ezmesi|yer fıstığı ezmesi', 588, 25, 20, 50, 'yemek kaşığı', 16, '', 'kahvalti'],
  ['kaymak', 'Kaymak', 'kaymak', 380, 2.5, 3, 40, 'yemek kaşığı', 15, '', 'kahvalti'],
  ['sucuk', 'Sucuk', 'sucuk', 380, 20, 2, 32, 'dilim', 8, 'porsiyon:50', 'kahvalti'],
  ['pastirma', 'Pastırma', 'pastırma', 250, 30, 1, 13, 'dilim', 10, '', 'kahvalti'],
  ['salam', 'Salam', 'salam|jambon|füme hindi', 250, 14, 2, 20, 'dilim', 10, '', 'kahvalti'],
  ['sosis', 'Sosis', 'sosis', 260, 11, 3, 23, 'adet', 40, '', 'kahvalti'],
  ['yulaf', 'Yulaf ezmesi', 'yulaf|yulaf ezmesi|yulaf lapası|overnight oats', 379, 13, 68, 6.5, 'yemek kaşığı', 10, 'kase:40,su bardağı:90,porsiyon:40', 'kahvalti'],
  ['granola', 'Granola / müsli', 'granola|müsli', 450, 10, 64, 17, 'kase', 50, 'yemek kaşığı:10', 'kahvalti'],
  ['misir-gevregi', 'Mısır gevreği', 'mısır gevreği|corn flakes|kahvaltılık gevrek', 380, 7, 84, 1, 'kase', 30, '', 'kahvalti'],
  ['yogurt', 'Yoğurt', 'yoğurt|tam yağlı yoğurt|ev yoğurdu', 61, 3.5, 4.7, 3.3, 'kase', 200, 'yemek kaşığı:30', 'kahvalti'],
  ['suzme-yogurt', 'Süzme yoğurt', 'süzme yoğurt|yunan yoğurdu|greek yoğurt', 100, 9, 4, 5, 'kase', 150, 'yemek kaşığı:30', 'kahvalti'],

  // Ekmek ve hamur işleri
  ['ekmek', 'Beyaz ekmek', 'ekmek|beyaz ekmek|somun|francala', 270, 9, 52, 2.8, 'dilim', 30, 'somun:250', 'ekmek', { whole: 250 }],
  ['tam-bugday-ekmek', 'Tam buğday ekmeği', 'tam buğday ekmeği|tam buğday|kepekli ekmek|esmer ekmek|tam tahıllı ekmek', 250, 10, 43, 3.5, 'dilim', 30, '', 'ekmek', { whole: 400 }],
  ['cavdar-ekmek', 'Çavdar ekmeği', 'çavdar ekmeği|çavdar', 259, 8.5, 48, 3.3, 'dilim', 30, '', 'ekmek'],
  ['lavas', 'Lavaş', 'lavaş|tortilla|dürüm ekmeği', 290, 9, 55, 4, 'adet', 70, '', 'ekmek'],
  ['bazlama', 'Bazlama', 'bazlama', 260, 8, 50, 3, 'adet', 150, '', 'ekmek'],
  ['pide-ekmek', 'Ramazan pidesi', 'ramazan pidesi|pide ekmeği', 270, 9, 53, 2.5, 'dilim', 50, '', 'ekmek', { whole: 300 }],
  ['simit', 'Simit', 'simit|gevrek', 330, 10, 60, 6, 'adet', 100, '', 'ekmek'],
  ['pogaca', 'Poğaça', 'poğaça|peynirli poğaça|zeytinli poğaça', 380, 8, 45, 18, 'adet', 70, '', 'ekmek'],
  ['acma', 'Açma', 'açma', 380, 7, 48, 18, 'adet', 80, '', 'ekmek'],
  ['su-boregi', 'Su böreği', 'su böreği|börek|kol böreği|kıymalı börek|ıspanaklı börek|peynirli börek', 260, 10, 22, 15, 'dilim', 150, 'porsiyon:150', 'ekmek'],
  ['sigara-boregi', 'Sigara böreği', 'sigara böreği|paçanga böreği', 300, 9, 25, 18, 'adet', 30, '', 'ekmek'],
  ['gozleme', 'Gözleme', 'gözleme', 250, 9, 32, 10, 'adet', 250, '', 'ekmek'],
  ['pisi', 'Pişi', 'pişi|hamur kızartması', 350, 7, 45, 16, 'adet', 60, '', 'ekmek'],
  ['kruvasan', 'Kruvasan', 'kruvasan|croissant', 406, 8, 46, 21, 'adet', 60, '', 'ekmek'],

  // Çorbalar
  ['mercimek-corbasi', 'Mercimek çorbası', 'mercimek çorbası|mercimek', 60, 3.5, 8.5, 1.5, 'kase', 250, 'kepçe:150', 'corba'],
  ['ezogelin', 'Ezogelin çorbası', 'ezogelin|ezogelin çorbası', 60, 3, 9, 1.5, 'kase', 250, 'kepçe:150', 'corba'],
  ['tarhana', 'Tarhana çorbası', 'tarhana|tarhana çorbası', 55, 2, 8, 1.5, 'kase', 250, 'kepçe:150', 'corba'],
  ['yayla', 'Yayla çorbası', 'yayla|yayla çorbası|yoğurt çorbası', 55, 2.5, 6, 2.3, 'kase', 250, 'kepçe:150', 'corba'],
  ['domates-corbasi', 'Domates çorbası', 'domates çorbası', 50, 1.5, 7, 2, 'kase', 250, 'kepçe:150', 'corba'],
  ['tavuk-corbasi', 'Tavuk çorbası', 'tavuk çorbası|tavuk suyu çorbası|şehriyeli tavuk çorbası', 45, 3, 5, 1.5, 'kase', 250, 'kepçe:150', 'corba'],
  ['iskembe', 'İşkembe çorbası', 'işkembe|işkembe çorbası|kelle paça', 75, 6, 3, 4.5, 'kase', 250, '', 'corba'],
  ['mantar-corbasi', 'Mantar çorbası', 'mantar çorbası|kremalı mantar çorbası', 60, 1.5, 6, 3.5, 'kase', 250, '', 'corba'],
  ['sebze-corbasi', 'Sebze çorbası', 'sebze çorbası|sebzeli çorba|çorba', 40, 1.5, 6, 1.2, 'kase', 250, 'kepçe:150', 'corba'],

  // Ev yemekleri
  ['kuru-fasulye', 'Kuru fasulye', 'kuru fasulye|etli kuru fasulye|fasulye', 130, 7, 15, 4.5, 'porsiyon', 250, 'tabak:300,kase:250', 'ana'],
  ['nohut', 'Nohut yemeği', 'nohut|nohut yemeği|etli nohut', 140, 7, 18, 4.5, 'porsiyon', 250, 'tabak:300', 'ana'],
  ['yesil-mercimek', 'Yeşil mercimek yemeği', 'yeşil mercimek|mercimek yemeği', 120, 7, 17, 3, 'porsiyon', 250, '', 'ana'],
  ['taze-fasulye', 'Zeytinyağlı taze fasulye', 'taze fasulye|zeytinyağlı fasulye', 70, 1.8, 7, 4, 'porsiyon', 200, 'tabak:250', 'ana'],
  ['ispanak', 'Ispanak yemeği', 'ıspanak|ıspanak yemeği', 60, 3, 4, 3.5, 'porsiyon', 200, '', 'ana'],
  ['turlu', 'Türlü', 'türlü|sebze yemeği|güveç', 75, 3, 7, 4, 'porsiyon', 250, '', 'ana'],
  ['karniyarik', 'Karnıyarık', 'karnıyarık', 150, 6, 8, 10.5, 'adet', 200, 'porsiyon:250', 'ana'],
  ['imam-bayildi', 'İmam bayıldı', 'imam bayıldı', 130, 1.5, 8, 10, 'porsiyon', 200, '', 'ana'],
  ['musakka', 'Musakka', 'musakka|patlıcan musakka', 135, 6, 7, 9, 'porsiyon', 250, '', 'ana'],
  ['biber-dolmasi', 'Etli dolma', 'dolma|biber dolması|etli dolma|kabak dolması', 130, 6, 13, 6, 'adet', 80, 'porsiyon:320', 'ana'],
  ['sarma', 'Yaprak sarma', 'sarma|yaprak sarma|zeytinyağlı sarma|yaprak dolması', 160, 2.5, 22, 7, 'adet', 15, 'porsiyon:150', 'ana'],
  ['manti', 'Mantı', 'mantı|kayseri mantısı', 180, 8, 22, 7, 'porsiyon', 250, 'tabak:300', 'ana'],
  ['patates-yemegi', 'Patates yemeği', 'patates yemeği|etli patates', 100, 4, 13, 4, 'porsiyon', 250, '', 'ana'],
  ['bezelye', 'Bezelye yemeği', 'bezelye|bezelye yemeği', 90, 4.5, 11, 3.5, 'porsiyon', 250, '', 'ana'],
  ['pilav', 'Pirinç pilavı', 'pilav|pirinç pilavı|tereyağlı pilav|beyaz pilav', 170, 3, 28, 5, 'porsiyon', 180, 'yemek kaşığı:20,tabak:250,kase:200', 'ana'],
  ['bulgur', 'Bulgur pilavı', 'bulgur|bulgur pilavı', 150, 4, 25, 4, 'porsiyon', 180, 'yemek kaşığı:20,tabak:250', 'ana'],
  ['makarna', 'Makarna', 'makarna|spagetti|penne|fırın makarna|soslu makarna', 180, 6, 30, 4, 'porsiyon', 200, 'tabak:250', 'ana'],
  ['bolonez', 'Bolonez makarna', 'bolonez|kıymalı makarna|spagetti bolonez', 160, 8, 20, 5, 'porsiyon', 300, '', 'ana'],
  ['eriste', 'Erişte', 'erişte', 170, 6, 30, 3, 'porsiyon', 200, '', 'ana'],
  ['kisir', 'Kısır', 'kısır', 140, 3, 20, 6, 'porsiyon', 150, 'yemek kaşığı:25', 'ana'],
  ['patates-haslama', 'Haşlanmış patates', 'haşlanmış patates|haşlama patates|fırın patates|patates', 87, 1.9, 20, 0.1, 'adet', 150, '', 'ana'],
  ['patates-puresi', 'Patates püresi', 'püre|patates püresi', 100, 2, 15, 4, 'porsiyon', 200, '', 'ana'],
  ['kumpir', 'Kumpir', 'kumpir', 160, 5, 18, 8, 'adet', 450, '', 'ana'],

  // Et, tavuk, balık
  ['tavuk-gogus', 'Tavuk göğüs (ızgara)', 'tavuk göğüs|tavuk göğsü|ızgara tavuk|haşlanmış tavuk|tavuk fileto|tavuk', 165, 31, 0, 3.6, 'porsiyon', 150, 'adet:150', 'et'],
  ['tavuk-but', 'Tavuk but', 'tavuk but|but|baget|pirzola tavuk|tavuk incik', 210, 26, 0, 11, 'adet', 120, 'porsiyon:200', 'et'],
  ['tavuk-kanat', 'Tavuk kanat', 'kanat|tavuk kanat|kanat ızgara', 260, 24, 0, 18, 'adet', 35, 'porsiyon:200', 'et'],
  ['tavuk-sote', 'Tavuk sote', 'tavuk sote|tavuk haşlama yemeği|tavuk yemeği', 140, 17, 4, 6, 'porsiyon', 250, '', 'et'],
  ['tavuk-sis', 'Tavuk şiş', 'tavuk şiş|şiş tavuk|çöp şiş tavuk', 165, 28, 2, 5, 'porsiyon', 200, 'şiş:60', 'et'],
  ['kofte', 'Izgara köfte', 'köfte|ızgara köfte|kasap köfte|inegöl köfte|izmir köfte', 250, 17, 6, 18, 'adet', 25, 'porsiyon:150', 'et'],
  ['kiyma', 'Kıyma (kavrulmuş)', 'kıyma', 250, 17, 0, 20, 'yemek kaşığı', 20, 'porsiyon:100', 'et'],
  ['biftek', 'Biftek / bonfile', 'biftek|bonfile|antrikot|steak|dana eti|et', 200, 28, 0, 10, 'porsiyon', 150, '', 'et'],
  ['pirzola', 'Kuzu pirzola', 'pirzola|kuzu pirzola|kuzu eti', 280, 25, 0, 20, 'adet', 50, 'porsiyon:200', 'et'],
  ['kavurma', 'Kavurma', 'kavurma|et kavurma|sac kavurma', 300, 25, 0, 22, 'porsiyon', 150, '', 'et'],
  ['adana', 'Adana kebap', 'adana|adana kebap|urfa|urfa kebap|kebap|kebab', 280, 16, 2, 23, 'porsiyon', 200, 'şiş:100', 'et'],
  ['sis-kebap', 'Şiş kebap', 'şiş kebap|kuşbaşı|çöp şiş', 210, 25, 1, 12, 'porsiyon', 200, 'şiş:70', 'et'],
  ['iskender', 'İskender', 'iskender|iskender kebap|bursa kebap', 180, 10, 13, 10, 'porsiyon', 400, '', 'et'],
  ['balik', 'Izgara balık', 'balık|levrek|çupra|ızgara balık|alabalık|mezgit|palamut|lüfer', 170, 24, 0, 8, 'porsiyon', 200, 'adet:250', 'et'],
  ['hamsi', 'Hamsi tava', 'hamsi|hamsi tava|balık tava', 250, 18, 8, 16, 'porsiyon', 200, '', 'et'],
  ['somon', 'Somon', 'somon|norveç somonu', 208, 20, 0, 13, 'porsiyon', 150, '', 'et'],
  ['ton', 'Ton balığı (konserve)', 'ton balığı|ton', 190, 26, 0, 9, 'kutu', 120, 'yemek kaşığı:20', 'et'],

  // Dışarıda / fast food
  ['doner-tavuk', 'Tavuk döner', 'tavuk döner|döner tavuk', 210, 19, 6, 12, 'porsiyon', 150, '', 'fastfood'],
  ['doner-et', 'Et döner', 'et döner|döner|döner kebap', 260, 18, 6, 18, 'porsiyon', 150, '', 'fastfood'],
  ['durum', 'Döner dürüm', 'dürüm|döner dürüm|tavuk dürüm|et dürüm|dürüm döner', 230, 12, 25, 9, 'adet', 300, '', 'fastfood'],
  ['yarim-ekmek-doner', 'Yarım ekmek döner', 'yarım ekmek döner|ekmek arası döner|ekmek arası', 240, 12, 28, 9, 'adet', 300, '', 'fastfood'],
  ['lahmacun', 'Lahmacun', 'lahmacun', 225, 10, 30, 7, 'adet', 130, '', 'fastfood'],
  ['pide', 'Kıymalı pide', 'pide|kıymalı pide|karışık pide|kuşbaşılı pide', 260, 11, 30, 10, 'adet', 300, 'dilim:60,porsiyon:300', 'fastfood'],
  ['kasarli-pide', 'Kaşarlı pide', 'kaşarlı pide|peynirli pide|yumurtalı pide', 280, 12, 31, 12, 'adet', 300, 'dilim:60', 'fastfood'],
  ['pizza', 'Pizza', 'pizza|karışık pizza|margarita pizza', 266, 11, 33, 10, 'dilim', 110, 'adet:800,porsiyon:330', 'fastfood'],
  ['hamburger', 'Hamburger', 'hamburger|burger|cheeseburger|köfte ekmek', 250, 13, 25, 11, 'adet', 220, '', 'fastfood'],
  ['tost', 'Kaşarlı tost', 'tost|kaşarlı tost|ayvalık tostu|karışık tost|sucuklu tost', 300, 13, 30, 14, 'adet', 160, '', 'fastfood'],
  ['patates-kizartmasi', 'Patates kızartması', 'patates kızartması|kızarmış patates|cips patates|french fries', 312, 3.4, 41, 15, 'porsiyon', 150, 'avuç:40', 'fastfood'],
  ['cig-kofte', 'Çiğ köfte dürüm', 'çiğ köfte|çiğköfte|çiğ köfte dürüm', 200, 5, 33, 5, 'adet', 230, 'porsiyon:150', 'fastfood'],
  ['midye', 'Midye dolma', 'midye|midye dolma', 160, 7, 22, 5, 'adet', 20, '', 'fastfood'],
  ['kokorec', 'Kokoreç', 'kokoreç', 260, 13, 20, 14, 'porsiyon', 250, 'yarım ekmek:250,çeyrek:150', 'fastfood'],
  ['tantuni', 'Tantuni', 'tantuni', 220, 12, 22, 9, 'adet', 250, '', 'fastfood'],
  ['islak-hamburger', 'Islak hamburger', 'ıslak hamburger|ıslak burger', 280, 10, 30, 13, 'adet', 120, '', 'fastfood'],
  ['waffle', 'Waffle', 'waffle', 290, 6, 38, 13, 'adet', 250, '', 'fastfood'],

  // Salata ve mezeler
  ['coban-salata', 'Çoban salata', 'çoban salata|çoban salatası|salata', 60, 1, 4, 4.5, 'porsiyon', 150, 'kase:200,tabak:250', 'salata'],
  ['mevsim-salata', 'Mevsim salata', 'mevsim salata|yeşil salata|marul', 40, 1.2, 4, 2.2, 'porsiyon', 150, 'kase:200', 'salata'],
  ['piyaz', 'Piyaz', 'piyaz', 120, 5, 14, 5, 'porsiyon', 150, '', 'salata'],
  ['cacik', 'Cacık', 'cacık|tzatziki', 45, 2.5, 3, 2.5, 'kase', 200, 'yemek kaşığı:30', 'salata'],
  ['haydari', 'Haydari', 'haydari', 160, 5, 4, 14, 'yemek kaşığı', 25, 'porsiyon:100', 'salata'],
  ['humus', 'Humus', 'humus', 166, 8, 14, 10, 'yemek kaşığı', 25, 'porsiyon:100', 'salata'],
  ['ezme', 'Acılı ezme', 'ezme|acılı ezme', 60, 1.5, 7, 3, 'yemek kaşığı', 20, 'porsiyon:100', 'salata'],
  ['avokado', 'Avokado', 'avokado', 160, 2, 9, 15, 'adet', 150, '', 'salata'],
  ['zeytinyagi', 'Zeytinyağı', 'zeytinyağı|sıvı yağ|ayçiçek yağı', 884, 0, 0, 100, 'yemek kaşığı', 13, 'tatlı kaşığı:5,çay kaşığı:3', 'diger'],

  // Meyveler
  ['elma', 'Elma', 'elma', 52, 0.3, 14, 0.2, 'adet', 150, '', 'meyve'],
  ['armut', 'Armut', 'armut', 57, 0.4, 15, 0.1, 'adet', 170, '', 'meyve'],
  ['muz', 'Muz', 'muz', 89, 1.1, 23, 0.3, 'adet', 120, '', 'meyve'],
  ['portakal', 'Portakal', 'portakal', 47, 0.9, 12, 0.1, 'adet', 140, '', 'meyve'],
  ['mandalina', 'Mandalina', 'mandalina|mandarin', 53, 0.8, 13, 0.3, 'adet', 80, '', 'meyve'],
  ['greyfurt', 'Greyfurt', 'greyfurt', 42, 0.8, 11, 0.1, 'adet', 250, '', 'meyve'],
  ['cilek', 'Çilek', 'çilek', 32, 0.7, 7.7, 0.3, 'adet', 12, 'kase:150,avuç:80', 'meyve'],
  ['uzum', 'Üzüm', 'üzüm', 69, 0.7, 18, 0.2, 'salkım', 150, 'kase:150,avuç:80,adet:5', 'meyve'],
  ['karpuz', 'Karpuz', 'karpuz', 30, 0.6, 7.6, 0.2, 'dilim', 300, '', 'meyve'],
  ['kavun', 'Kavun', 'kavun', 34, 0.8, 8, 0.2, 'dilim', 200, '', 'meyve'],
  ['seftali', 'Şeftali', 'şeftali|nektarin', 39, 0.9, 10, 0.3, 'adet', 150, '', 'meyve'],
  ['kayisi', 'Kayısı', 'kayısı|zerdali', 48, 1.4, 11, 0.4, 'adet', 35, '', 'meyve'],
  ['kiraz', 'Kiraz', 'kiraz|vişne', 63, 1, 16, 0.2, 'avuç', 80, 'kase:150,adet:7', 'meyve'],
  ['incir', 'İncir', 'incir|taze incir', 74, 0.8, 19, 0.3, 'adet', 50, '', 'meyve'],
  ['nar', 'Nar', 'nar', 83, 1.7, 19, 1.2, 'adet', 250, 'kase:150', 'meyve'],
  ['kivi', 'Kivi', 'kivi', 61, 1.1, 15, 0.5, 'adet', 75, '', 'meyve'],
  ['erik', 'Erik', 'erik|can erik', 46, 0.7, 11, 0.3, 'adet', 30, 'avuç:100', 'meyve'],
  ['hurma', 'Hurma', 'hurma', 282, 2.5, 75, 0.4, 'adet', 8, '', 'meyve'],
  ['kuru-kayisi', 'Kuru kayısı', 'kuru kayısı|gün kurusu', 241, 3.4, 63, 0.5, 'adet', 8, 'avuç:40', 'meyve'],
  ['kuru-uzum', 'Kuru üzüm', 'kuru üzüm', 299, 3, 79, 0.5, 'yemek kaşığı', 10, 'avuç:30', 'meyve'],
  ['kuru-incir', 'Kuru incir', 'kuru incir', 249, 3.3, 64, 0.9, 'adet', 20, '', 'meyve'],
  ['ananas', 'Ananas', 'ananas', 50, 0.5, 13, 0.1, 'dilim', 80, 'kase:160', 'meyve'],
  ['mango', 'Mango', 'mango', 60, 0.8, 15, 0.4, 'adet', 200, 'kase:160', 'meyve'],
  ['yaban-mersini', 'Yaban mersini / orman meyvesi', 'yaban mersini|orman meyvesi|böğürtlen|ahududu|frambuaz', 50, 0.9, 12, 0.3, 'kase', 150, 'avuç:60', 'meyve'],
  ['ayva', 'Ayva', 'ayva', 57, 0.4, 15, 0.1, 'adet', 250, '', 'meyve'],
  ['kuru-erik', 'Kuru erik', 'kuru erik', 240, 2.2, 64, 0.4, 'adet', 10, 'avuç:40', 'meyve'],

  // Sebze ve sebze yemekleri
  ['brokoli', 'Brokoli', 'brokoli|haşlanmış brokoli', 35, 2.8, 7, 0.4, 'porsiyon', 150, 'kase:100', 'salata'],
  ['havuc', 'Havuç', 'havuç', 41, 0.9, 10, 0.2, 'adet', 70, '', 'salata'],
  ['marul', 'Yeşillik', 'roka|maydanoz|dereotu|yeşillik|semizotu|tere', 22, 2, 3, 0.4, 'avuç', 30, 'demet:100', 'salata'],
  ['misir', 'Haşlanmış mısır', 'mısır|haşlanmış mısır|közde mısır|konserve mısır', 96, 3.4, 21, 1.5, 'adet', 150, 'yemek kaşığı:15,kase:150', 'salata'],
  ['mantar-sote', 'Mantar sote', 'mantar|mantar sote', 70, 3, 4, 5, 'porsiyon', 150, '', 'ana'],
  ['kabak-yemegi', 'Kabak yemeği', 'kabak|kabak yemeği|zeytinyağlı kabak', 55, 1.5, 5, 3.5, 'porsiyon', 200, '', 'ana'],
  ['mucver', 'Mücver', 'mücver', 190, 7, 15, 11, 'adet', 50, 'porsiyon:150', 'ana'],
  ['karnabahar', 'Karnabahar', 'karnabahar|karnabahar kızartması|karnabahar yemeği', 70, 2.5, 6, 4, 'porsiyon', 200, '', 'ana'],
  ['pirasa', 'Zeytinyağlı pırasa', 'pırasa|zeytinyağlı pırasa', 75, 1.5, 9, 4, 'porsiyon', 200, '', 'ana'],
  ['enginar', 'Zeytinyağlı enginar', 'enginar', 80, 2.5, 9, 4.5, 'adet', 150, '', 'ana'],
  ['barbunya', 'Zeytinyağlı barbunya', 'barbunya|zeytinyağlı barbunya', 110, 5.5, 14, 4, 'porsiyon', 200, '', 'ana'],
  ['lahana-sarma', 'Etli lahana sarması', 'lahana sarması|lahana dolması|etli lahana', 120, 5, 12, 6, 'adet', 50, 'porsiyon:250', 'ana'],
  ['patlican-kizartma', 'Patlıcan kızartması', 'patlıcan kızartması|kızartma|şakşuka|patlıcan', 180, 1.5, 9, 16, 'porsiyon', 150, '', 'ana'],
  ['hunkar', 'Hünkar beğendi', 'hünkar beğendi|hünkar|ali nazik', 170, 10, 7, 11, 'porsiyon', 300, '', 'ana'],
  ['icli-kofte', 'İçli köfte', 'içli köfte|içli', 250, 9, 25, 13, 'adet', 70, '', 'ana'],
  ['mercimek-koftesi', 'Mercimek köftesi', 'mercimek köftesi|fellah köftesi', 160, 6, 27, 3.5, 'adet', 30, 'porsiyon:150', 'ana'],
  ['tavuk-pilav', 'Tavuk pilav', 'tavuk pilav|tavuklu pilav|nohutlu pilav|etli pilav', 180, 9, 24, 5.5, 'porsiyon', 300, '', 'ana'],
  ['kuskus', 'Kuskus', 'kuskus', 150, 5, 28, 2, 'porsiyon', 180, '', 'ana'],
  ['kinoa', 'Kinoa', 'kinoa|quinoa', 120, 4.4, 21, 1.9, 'kase', 185, 'porsiyon:150,yemek kaşığı:15', 'ana'],
  ['mihlama', 'Mıhlama / kuymak', 'mıhlama|kuymak|muhlama', 330, 10, 12, 27, 'porsiyon', 200, '', 'kahvalti'],
  ['yumurta-beyazi', 'Yumurta beyazı', 'yumurta beyazı|yumurta akı', 52, 11, 0.7, 0.2, 'adet', 33, '', 'kahvalti'],
  ['light-yogurt', 'Light yoğurt', 'light yoğurt|yağsız yoğurt|az yağlı yoğurt', 40, 4, 5, 0.5, 'kase', 200, 'yemek kaşığı:30', 'kahvalti'],
  ['chia-puding', 'Chia puding', 'chia puding|chia', 160, 5, 15, 9, 'kase', 150, 'yemek kaşığı:12', 'kahvalti'],
  ['pankek', 'Pankek', 'pankek|krep|pancake', 230, 6, 30, 9, 'adet', 60, '', 'kahvalti'],
  ['avokadolu-tost', 'Avokadolu tost', 'avokadolu tost|avokado tost', 230, 6, 22, 13, 'adet', 150, '', 'fastfood'],

  // Kafe ve dışarıda
  ['sezar-salata', 'Sezar salata', 'sezar|sezar salata|tavuklu salata', 150, 10, 7, 9, 'porsiyon', 300, '', 'salata'],
  ['ton-salata', 'Ton balıklı salata', 'ton balıklı salata|ton salata', 120, 10, 5, 7, 'porsiyon', 300, '', 'salata'],
  ['nugget', 'Tavuk nugget / çıtır tavuk', 'nugget|tavuk nugget|çıtır tavuk|tavuk kızartma|kfc', 280, 16, 16, 17, 'adet', 18, 'porsiyon:150', 'fastfood'],
  ['wrap', 'Tavuklu wrap', 'wrap|tavuk wrap|tavuklu wrap', 210, 12, 22, 8, 'adet', 250, '', 'fastfood'],
  ['sandvic', 'Sandviç', 'sandviç|sandvic|baget sandviç|kumru', 250, 11, 30, 9, 'adet', 200, '', 'fastfood'],
  ['sucuk-ekmek', 'Sucuk ekmek', 'sucuk ekmek', 300, 12, 30, 15, 'adet', 250, '', 'fastfood'],
  ['cig-borek', 'Çiğ börek', 'çiğ börek|çibörek', 300, 10, 28, 17, 'adet', 120, '', 'fastfood'],
  ['makarna-beyaz-soslu', 'Kremalı makarna', 'kremalı makarna|alfredo|beyaz soslu makarna', 210, 7, 26, 9, 'porsiyon', 300, '', 'fastfood'],
  ['sushi', 'Suşi', 'suşi|sushi', 150, 6, 28, 1.5, 'adet', 30, 'porsiyon:240', 'fastfood'],
  ['kumpir-sade', 'Fırın patates (sade)', 'közde patates', 95, 2.5, 21, 0.1, 'adet', 250, '', 'ana'],

  // Tatlı (ek)
  ['ekmek-kadayifi', 'Ekmek kadayıfı', 'ekmek kadayıfı', 330, 4, 50, 13, 'porsiyon', 120, '', 'tatli'],
  ['gullac', 'Güllaç', 'güllaç', 150, 4, 26, 3.5, 'dilim', 150, '', 'tatli'],
  ['kemalpasa', 'Kemalpaşa / şambali', 'kemalpaşa|şambali|şam tatlısı', 340, 5, 55, 11, 'adet', 40, 'porsiyon:120', 'tatli'],
  ['granola-bar', 'Granola / yulaf bar', 'granola bar|yulaf bar|müsli bar|tahıl bar', 420, 7, 64, 15, 'adet', 30, '', 'tatli'],
  ['sekerleme', 'Şekerleme', 'jelibon|şekerleme|akide|lolipop', 340, 4, 80, 0, 'adet', 6, 'paket:80,avuç:30', 'tatli'],
  ['meyveli-yogurt', 'Meyveli yoğurt', 'meyveli yoğurt|probiyotik yoğurt', 95, 3.5, 15, 2.5, 'kase', 150, 'adet:150', 'tatli'],

  // İçecek (ek)
  ['boza', 'Boza', 'boza', 100, 1, 22, 0.5, 'bardak', 200, '', 'icecek', { hydration: 0.8 }],
  ['sira', 'Şıra', 'şıra', 60, 0.2, 15, 0, 'bardak', 200, '', 'icecek', { hydration: 0.85 }],
  ['kombucha', 'Kombucha', 'kombucha', 13, 0, 3, 0, 'şişe', 330, 'bardak:200', 'icecek', { hydration: 0.95 }],
  ['smoothie', 'Smoothie', 'smoothie|milkshake|frozen', 80, 2, 15, 1.5, 'bardak', 350, 'büyük:500', 'icecek', { hydration: 0.8 }],
  ['protein-shake', 'Protein shake (sütlü)', 'protein shake|protein içeceği|shake', 75, 9, 6, 1.5, 'bardak', 350, '', 'icecek', { hydration: 0.85 }],
  ['ayran-light', 'Light ayran', 'light ayran|yağsız ayran', 25, 1.8, 2.5, 0.6, 'bardak', 200, '', 'icecek', { hydration: 0.95 }],
  ['soda-limon', 'Limonlu soda', 'limonlu soda|meyveli maden suyu', 20, 0, 5, 0, 'şişe', 200, '', 'icecek', { hydration: 0.95 }],
  ['mocha', 'Mocha / şuruplu kahve', 'mocha|karamel macchiato|frappe|frappuccino|şuruplu kahve', 90, 3, 13, 3, 'bardak', 350, 'büyük:470', 'icecek', { hydration: 0.8 }],

  // Kuruyemiş
  ['ceviz', 'Ceviz', 'ceviz|ceviz içi', 654, 15, 14, 65, 'adet', 5, 'avuç:30', 'kuruyemis'],
  ['findik', 'Fındık', 'fındık|fındık içi', 628, 15, 17, 61, 'adet', 1.5, 'avuç:30', 'kuruyemis'],
  ['badem', 'Badem', 'badem|çiğ badem', 579, 21, 22, 50, 'adet', 1.2, 'avuç:30', 'kuruyemis'],
  ['antep-fistigi', 'Antep fıstığı', 'antep fıstığı|şam fıstığı|fıstık', 560, 20, 28, 45, 'avuç', 30, 'adet:0.7', 'kuruyemis'],
  ['kaju', 'Kaju', 'kaju', 553, 18, 30, 44, 'avuç', 30, 'adet:1.5', 'kuruyemis'],
  ['yer-fistigi', 'Yer fıstığı', 'yer fıstığı|kabuklu fıstık', 567, 26, 16, 49, 'avuç', 30, '', 'kuruyemis'],
  ['leblebi', 'Leblebi', 'leblebi', 360, 22, 58, 5, 'avuç', 30, '', 'kuruyemis'],
  ['cekirdek', 'Ay çekirdeği', 'çekirdek|ay çekirdeği|kabak çekirdeği', 584, 21, 20, 51, 'avuç', 30, 'paket:60', 'kuruyemis'],

  // Tatlı ve atıştırmalık
  ['baklava', 'Baklava', 'baklava|fıstıklı baklava|cevizli baklava', 430, 6, 50, 23, 'dilim', 40, 'porsiyon:120', 'tatli'],
  ['kunefe', 'Künefe', 'künefe|kadayıf|tel kadayıf', 360, 8, 40, 19, 'porsiyon', 150, '', 'tatli'],
  ['sutlac', 'Sütlaç', 'sütlaç|fırın sütlaç|muhallebi|keşkül|puding', 120, 3.5, 20, 3, 'kase', 200, '', 'tatli'],
  ['kazandibi', 'Kazandibi / tavuk göğsü tatlısı', 'kazandibi|tavuk göğsü tatlısı', 140, 4, 22, 4, 'porsiyon', 150, '', 'tatli'],
  ['revani', 'Revani / şerbetli tatlı', 'revani|şekerpare|tulumba|lokma|şerbetli tatlı', 330, 4, 55, 10, 'dilim', 80, 'adet:30', 'tatli'],
  ['lokum', 'Lokum', 'lokum|türk lokumu', 380, 0.2, 94, 0.2, 'adet', 12, '', 'tatli'],
  ['helva', 'Tahin helvası', 'helva|tahin helvası', 520, 12, 55, 29, 'dilim', 40, '', 'tatli'],
  ['irmik-helvasi', 'İrmik helvası', 'irmik helvası|un helvası', 340, 5, 45, 16, 'porsiyon', 120, '', 'tatli'],
  ['dondurma', 'Dondurma', 'dondurma|maraş dondurması', 210, 3.5, 24, 11, 'top', 50, 'külah:100,kase:150', 'tatli'],
  ['sutlu-cikolata', 'Sütlü çikolata', 'çikolata|sütlü çikolata|tablet çikolata', 535, 7.6, 59, 30, 'kare', 6, 'adet:40,paket:80', 'tatli'],
  ['bitter', 'Bitter çikolata', 'bitter|bitter çikolata|siyah çikolata', 550, 7.8, 45, 38, 'kare', 6, 'adet:40,paket:80', 'tatli'],
  ['kek', 'Kek', 'kek|pasta|yaş pasta|cheesecake|brownie', 380, 5.5, 50, 18, 'dilim', 80, '', 'tatli'],
  ['kurabiye', 'Kurabiye', 'kurabiye|un kurabiyesi|cookie', 480, 6, 62, 23, 'adet', 15, '', 'tatli'],
  ['biskuvi', 'Bisküvi', 'bisküvi|petibör|kraker|galeta', 450, 7, 70, 15, 'adet', 8, 'paket:75', 'tatli'],
  ['gofret', 'Gofret / çikolatalı bar', 'gofret|çikolatalı bar|bar|albeni|kitkat|snickers', 520, 6, 64, 27, 'adet', 35, '', 'tatli'],
  ['asure', 'Aşure', 'aşure', 140, 3, 28, 2, 'kase', 200, '', 'tatli'],
  ['profiterol', 'Profiterol', 'profiterol|ekler', 280, 5, 30, 16, 'porsiyon', 150, '', 'tatli'],
  ['cips', 'Cips', 'cips|patates cipsi|mısır cipsi', 536, 7, 53, 34, 'paket', 40, 'avuç:20,büyük paket:110', 'tatli'],
  ['seker', 'Şeker', 'şeker|toz şeker|küp şeker', 387, 0, 100, 0, 'küp', 5, 'tatlı kaşığı:5,çay kaşığı:4,yemek kaşığı:12', 'diger'],
  ['protein-bar', 'Protein bar', 'protein bar|proteinli bar', 360, 30, 35, 12, 'adet', 50, '', 'tatli'],
  ['protein-tozu', 'Protein tozu', 'protein tozu|whey|protein', 400, 80, 8, 6, 'ölçek', 30, '', 'diger'],

  // İçecekler (100 ml başına)
  ['su', 'Su', 'su|maden suyu|soda|sade soda', 0, 0, 0, 0, 'bardak', 200, 'şişe:500,büyük şişe:1500,küçük şişe:330,pet şişe:500', 'icecek', { hydration: 1 }],
  ['cay', 'Çay', 'çay|siyah çay|demli çay|açık çay|yeşil çay|bitki çayı|ıhlamur|adaçayı|papatya çayı', 1, 0, 0.2, 0, 'bardak', 100, 'kupa:250,demlik:600', 'icecek', { hydration: 0.9 }],
  ['sekerli-cay', 'Şekerli çay', 'şekerli çay', 20, 0, 5, 0, 'bardak', 100, 'kupa:250', 'icecek', { hydration: 0.9 }],
  ['turk-kahvesi', 'Türk kahvesi', 'türk kahvesi|sade türk kahvesi', 7, 0.3, 1, 0.3, 'fincan', 70, '', 'icecek', { hydration: 0.8 }],
  ['sekerli-turk-kahvesi', 'Şekerli Türk kahvesi', 'şekerli türk kahvesi|orta şekerli kahve|orta kahve|şekerli kahve', 40, 0.3, 9, 0.3, 'fincan', 70, '', 'icecek', { hydration: 0.8 }],
  ['filtre-kahve', 'Filtre kahve / americano', 'kahve|filtre kahve|americano|espresso|sade kahve|siyah kahve|nescafe', 2, 0.1, 0, 0, 'kupa', 250, 'bardak:200,fincan:60', 'icecek', { hydration: 0.8 }],
  ['latte', 'Latte', 'latte|sütlü kahve|caffe latte|flat white', 55, 3, 5, 2.5, 'bardak', 350, 'kupa:300,küçük:250,büyük:470', 'icecek', { hydration: 0.85 }],
  ['cappuccino', 'Cappuccino', 'cappuccino|kapuçino', 40, 2.2, 4, 1.7, 'bardak', 250, 'büyük:350', 'icecek', { hydration: 0.85 }],
  ['3u1-arada', '3ü 1 arada kahve', '3ü 1 arada|3 ü 1 arada|üçü bir arada|hazır kahve', 430, 3, 75, 13, 'paket', 18, '', 'icecek', { hydration: 0 }],
  ['sut', 'Süt', 'süt|yarım yağlı süt|sıcak süt', 46, 3.3, 4.8, 1.6, 'bardak', 200, 'kupa:250', 'icecek', { hydration: 0.9 }],
  ['tam-yagli-sut', 'Tam yağlı süt', 'tam yağlı süt', 61, 3.2, 4.8, 3.3, 'bardak', 200, '', 'icecek', { hydration: 0.9 }],
  ['ayran', 'Ayran', 'ayran|yayık ayranı', 36, 1.7, 2.4, 1.9, 'bardak', 200, 'kutu:200,şişe:300,büyük:300', 'icecek', { hydration: 0.9 }],
  ['kefir', 'Kefir', 'kefir', 52, 3.4, 4.5, 2, 'bardak', 200, 'şişe:500', 'icecek', { hydration: 0.9 }],
  ['kola', 'Kola / gazlı içecek', 'kola|coca cola|gazoz|fanta|sprite|gazlı içecek|meyveli soda', 42, 0, 10.6, 0, 'kutu', 330, 'bardak:200,şişe:500,litre:1000', 'icecek', { hydration: 0.85 }],
  ['zero-kola', 'Şekersiz kola', 'zero|kola zero|diyet kola|light kola|şekersiz kola', 0.3, 0, 0, 0, 'kutu', 330, 'bardak:200,şişe:500', 'icecek', { hydration: 0.9 }],
  ['portakal-suyu', 'Portakal suyu', 'portakal suyu|taze sıkma portakal suyu|sıkma portakal', 45, 0.7, 10, 0.2, 'bardak', 200, '', 'icecek', { hydration: 0.85 }],
  ['meyve-suyu', 'Meyve suyu', 'meyve suyu|vişne suyu|şeftali suyu|elma suyu|nektar', 50, 0.3, 12, 0.1, 'bardak', 200, 'kutu:200,şişe:1000', 'icecek', { hydration: 0.85 }],
  ['limonata', 'Limonata', 'limonata', 45, 0, 11, 0, 'bardak', 250, '', 'icecek', { hydration: 0.85 }],
  ['salgam', 'Şalgam', 'şalgam|şalgam suyu', 4, 0.1, 0.8, 0, 'bardak', 200, 'şişe:300', 'icecek', { hydration: 0.9 }],
  ['soguk-cay', 'Soğuk çay / ice tea', 'ice tea|soğuk çay|fuse tea|lipton ice tea', 28, 0, 7, 0, 'kutu', 330, 'şişe:500,bardak:200', 'icecek', { hydration: 0.85 }],
  ['enerji-icecegi', 'Enerji içeceği', 'enerji içeceği|redbull|red bull|monster', 45, 0, 11, 0, 'kutu', 250, 'büyük kutu:500', 'icecek', { hydration: 0.7 }],
  ['salep', 'Salep', 'salep|sıcak çikolata', 85, 3, 14, 2, 'bardak', 200, 'kupa:250', 'icecek', { hydration: 0.8 }],
  ['bira', 'Bira', 'bira', 43, 0.5, 3.6, 0, 'kutu', 500, 'şişe:500,küçük şişe:330,bardak:400', 'icecek', { hydration: 0 }],
  ['sarap', 'Şarap', 'şarap|kırmızı şarap|beyaz şarap', 85, 0.1, 2.6, 0, 'kadeh', 150, 'şişe:750', 'icecek', { hydration: 0 }],
  ['raki', 'Rakı', 'rakı|viski|votka|cin|alkol', 240, 0, 0, 0, 'tek', 40, 'duble:80,kadeh:40', 'icecek', { hydration: 0 }],
];

function parseUnits(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!s) return out;
  for (const part of s.split(',')) {
    const [u, g] = part.split(':');
    out[u.trim()] = Number(g);
  }
  return out;
}

export const FOODS: Food[] = ROWS.map(([id, name, aliases, kcal, p, c, f, unit, grams, units, group, extra]) => ({
  id, name,
  aliases: aliases.split('|').map((a) => a.trim()),
  kcal, p, c, f, unit, grams,
  units: { [unit]: grams, ...parseUnits(units) },
  group,
  ...extra,
}));

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export const GROUP_LABELS: Record<FoodGroup, string> = {
  kahvalti: 'Kahvaltılık', ekmek: 'Ekmek ve hamur işi', corba: 'Çorba', ana: 'Ev yemeği', et: 'Et, tavuk, balık',
  fastfood: 'Dışarıda', salata: 'Salata ve meze', meyve: 'Meyve', kuruyemis: 'Kuruyemiş', tatli: 'Tatlı ve atıştırmalık',
  icecek: 'İçecek', diger: 'Diğer',
};

/** Belirli gram için besin değeri */
export function nutrientsFor(food: Food, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(food.kcal * k),
    p: Math.round(food.p * k * 10) / 10,
    c: Math.round(food.c * k * 10) / 10,
    f: Math.round(food.f * k * 10) / 10,
  };
}
