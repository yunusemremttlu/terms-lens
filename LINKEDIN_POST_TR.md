Sözleşme metinlerini baştan sona okumak zor; önemli bir maddeyi gözden kaçırmak da kolay. Bu yüzden Terms Lens adlı küçük bir Chrome uzantısı prototipi geliştirdim.

Kullanım koşulları, gizlilik politikası veya abonelik şartları açıldığında sayfanın görünür ana metnini analiz için hazırlıyor. Alibaba Page Agent ile yapılandırılmış bir LLM kullanıyor; sonuç serbest metin değil, JSON şemasından geçiyor. Daha önemlisi, her risk maddesi kaynak metinden birebir alıntıyla doğrulanmadıkça rapora girmiyor. Risk puanı da modelden alınmıyor; doğrulanmış maddelerden deterministik olarak hesaplanıyor.

İlk demo; alıntıyla desteklenen bir riski, gizli prompt injection denemesini ve kaynakta bulunmayan bir alıntının dürüstçe reddedilmesini gösteriyor. Mini eval için beş gerçek hizmet koşulu sayfasından kısa, kaynak bağlantılı örnekler hazırladım; canlı model değerlendirmesi ise kullanıcının kendi API anahtarıyla çalıştırılıyor.

Bu araç **hukuki tavsiye vermez** ve sözleşmenin tamamını okumanın yerini tutmaz. Amacı, sorulması gereken soruları daha hızlı görünür kılmak.

Geri bildirime açığım: Hangi sözleşme maddesi türü sizce en kolay gözden kaçıyor?

#ChromeExtension #Privacy #AI #ConsumerRights #PromptInjection #OpenSource
