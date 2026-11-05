-- ARAM store · seed · starter data (roles, settings, categories, pages, sample catalogue).
-- Run AFTER 0001–0006. Idempotent and non-destructive: only inserts missing rows; never overwrites values you edited.
begin;
select public.aram_require('0006', null);

insert into public.admin_roles (name, label_fa, permissions) values
  ('super_admin', 'مدیر کل', array['*']),
  ('manager', 'مدیر فروشگاه', array['products.manage','catalog.manage','orders.manage','customers.manage','marketing.manage','reviews.manage','cms.manage','analytics.view','logs.view']),
  ('content_editor', 'ویرایشگر محتوا', array['products.manage','catalog.manage','cms.manage','reviews.manage']),
  ('support', 'پشتیبانی', array['orders.manage','customers.manage','reviews.manage'])
on conflict (name) do nothing;

insert into public.settings (key, value, is_public) values
  ('store_name', '"آرام"', true),
  ('tagline', '"پوشاک ساده و ماندگار"', true),
  ('announcement', '"ارسال رایگان برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان"', true),
  ('shipping_fee', '250000', true),
  ('free_shipping_threshold', '5000000', true),
  ('contact_email', '""', true),
  ('contact_phone', '""', true),
  ('instagram', '""', true),
  ('bank_card_info', '""', false),
  ('hero_title', '"سکوت، زیباترین لباس است"', true),
  ('hero_subtitle', '"مجموعه پاییز؛ برش‌های ساده، پارچه‌های اصیل و رنگ‌های خاموش."', true),
  ('hero_cta_label', '"مشاهده مجموعه"', true),
  ('hero_cta_link', '"/shop?new=1"', true),
  ('statement', '"لباسی که هر سال بیشتر دوستش داشته باشید."', true)
on conflict (key) do nothing;

insert into public.categories (slug, name_fa, name_en, sort_order) values
  ('outerwear','بالاپوش','Outerwear',1), ('tops','بلوز و پیراهن','Tops',2), ('knitwear','بافت','Knitwear',3),
  ('bottoms','شلوار و دامن','Bottoms',4), ('dresses','پیراهن زنانه','Dresses',5), ('accessories','اکسسوری','Accessories',6)
on conflict (slug) do nothing;

insert into public.cms_pages (slug, title_fa, body_fa, is_published) values
  ('about','درباره آرام','آرام با این باور ساخته شد که لباس خوب نیازی به فریاد ندارد.

## رویکرد ما
برش‌های ساده، پارچه‌های طبیعی و رنگ‌های خاموش؛ لباس‌هایی که از فصلی به فصل دیگر می‌مانند.', true),
  ('shipping-returns','ارسال و بازگشت','## ارسال
سفارش‌ها پس از تأیید آماده‌سازی و ارسال می‌شوند. هزینه ارسال هنگام ثبت سفارش نمایش داده می‌شود.

## بازگشت
برای شرایط بازگشت کالا با پشتیبانی تماس بگیرید. (متن را از بخش مدیریت محتوا ویرایش کنید.)', true)
on conflict (slug) do nothing;

do $$
declare rec jsonb; pid uuid; cid uuid; col jsonb; sz text; i int := 0; n int;
begin
  if exists (select 1 from public.products) then return; end if;
  for rec in select * from jsonb_array_elements($j$[
   {"slug":"long-wool-coat","fa":"پالتوی پشمی بلند","en":"Long Wool Coat","cat":"outerwear","price":18900000,"tone":"taupe","sil":"coat","new":true,"feat":true,"mat":"۹۰٪ پشم، ۱۰٪ کشمیر","desc":"پالتوی راسته با یقه‌ی باز و آستر ابریشمی.","colors":[{"n":"قهوه‌ای روشن","h":"#A59A88"},{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L"]},
   {"slug":"silk-blend-blazer","fa":"کت ابریشمی ساده","en":"Silk Blend Blazer","cat":"outerwear","price":14500000,"tone":"stone","sil":"coat","feat":true,"mat":"ابریشم و پشم","desc":"کت تک‌دکمه با شانه‌ی نرم.","colors":[{"n":"سنگی","h":"#7B7469"}],"sizes":["S","M","L"]},
   {"slug":"linen-shirt","fa":"پیراهن کتانی یقه‌دار","en":"Linen Shirt","cat":"tops","price":4200000,"tone":"ivory","sil":"top","new":true,"mat":"کتان خالص","desc":"پیراهن گشاد با دکمه‌های صدفی.","colors":[{"n":"عاجی","h":"#F1ECE1"},{"n":"شنی","h":"#DDD4C3"}],"sizes":["S","M","L","XL"]},
   {"slug":"satin-blouse","fa":"بلوز ساتن آستین‌بلند","en":"Satin Blouse","cat":"tops","price":5800000,"tone":"sand","sil":"top","feat":true,"mat":"ساتن ویسکوز","desc":"بلوز روان با یقه‌ی ساده.","colors":[{"n":"شنی","h":"#DDD4C3"}],"sizes":["S","M","L"]},
   {"slug":"organic-cotton-tee","fa":"تی‌شرت پنبه ارگانیک","en":"Organic Cotton Tee","cat":"tops","price":1900000,"tone":"ivory","sil":"top","mat":"پنبه ارگانیک","desc":"تی‌شرت ضخیم با یقه‌ی گرد.","colors":[{"n":"عاجی","h":"#F1ECE1"},{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L","XL"]},
   {"slug":"tailored-trousers","fa":"شلوار فاستونی راسته","en":"Tailored Trousers","cat":"bottoms","price":6400000,"tone":"charcoal","sil":"trousers","feat":true,"mat":"فاستونی پشمی","desc":"شلوار کمر بلند با خط اتو.","colors":[{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L"]},
   {"slug":"pleated-midi-skirt","fa":"دامن میدی پلیسه","en":"Pleated Midi Skirt","cat":"bottoms","price":5200000,"tone":"mocha","sil":"skirt","new":true,"mat":"پلی‌استر بازیافتی","desc":"دامن پلیسه با کمر کشی.","colors":[{"n":"موکا","h":"#6E5F52"}],"sizes":["S","M","L"]},
   {"slug":"crepe-maxi-dress","fa":"پیراهن بلند کرپ","en":"Crepe Maxi Dress","cat":"dresses","price":9800000,"tone":"sand","sil":"dress","feat":true,"mat":"کرپ ویسکوز","desc":"پیراهن بلند با فرم A و یقه‌ی قایقی.","colors":[{"n":"شنی","h":"#DDD4C3"},{"n":"موکا","h":"#6E5F52"}],"sizes":["S","M","L"]},
   {"slug":"shirt-dress","fa":"پیراهن شمیز ساده","en":"Shirt Dress","cat":"dresses","price":7300000,"compare":8600000,"tone":"stone","sil":"dress","mat":"پنبه پوپلین","desc":"شمیز کمربند‌دار تا زیر زانو.","colors":[{"n":"سنگی","h":"#7B7469"}],"sizes":["S","M","L"]},
   {"slug":"leather-shoulder-bag","fa":"کیف دوشی چرم","en":"Leather Shoulder Bag","cat":"accessories","price":12400000,"tone":"mocha","sil":"bag","feat":true,"mat":"چرم طبیعی","desc":"کیف ساختاریافته با بند قابل‌تنظیم.","colors":[{"n":"موکا","h":"#6E5F52"},{"n":"مشکی","h":"#191715"}],"sizes":["یک‌سایز"]},
   {"slug":"cashmere-scarf","fa":"شال کشمیر","en":"Cashmere Scarf","cat":"accessories","price":6900000,"tone":"taupe","sil":"scarf","new":true,"mat":"کشمیر خالص","desc":"شال نرم و سبک با حاشیه‌ی ساده.","colors":[{"n":"قهوه‌ای روشن","h":"#A59A88"}],"sizes":["یک‌سایز"]},
   {"slug":"merino-crewneck","fa":"بافت پشمی یقه‌گرد","en":"Merino Crewneck","cat":"knitwear","price":4800000,"tone":"sand","sil":"knit","mat":"پشم مرینو","desc":"بافت نازک و گرم برای لایه‌بندی.","colors":[{"n":"شنی","h":"#DDD4C3"},{"n":"زغالی","h":"#35322E"}],"sizes":["S","M","L"]}
  ]$j$::jsonb) loop
    i := i + 1;
    select id into cid from public.categories where slug = rec ->> 'cat';
    insert into public.products (slug, title_fa, title_en, description_fa, material_fa, care_fa, category_id, base_price, compare_at_price, status, is_featured, is_new, tone, silhouette)
    values (rec ->> 'slug', rec ->> 'fa', rec ->> 'en', rec ->> 'desc', rec ->> 'mat', 'شست‌وشوی ملایم یا خشک‌شویی؛ اتو در دمای پایین.', cid,
            (rec ->> 'price')::numeric, nullif(rec ->> 'compare', '')::numeric, 'active',
            coalesce((rec ->> 'feat')::boolean, false), coalesce((rec ->> 'new')::boolean, false), rec ->> 'tone', rec ->> 'sil')
    returning id into pid;
    n := 0;
    for col in select * from jsonb_array_elements(rec -> 'colors') loop
      for sz in select jsonb_array_elements_text(rec -> 'sizes') loop
        n := n + 1;
        insert into public.product_variants (product_id, sku, color_name, color_hex, size, stock)
        values (pid, upper(substr(rec ->> 'slug', 1, 4)) || '-' || i || '-' || n, col ->> 'n', col ->> 'h', sz, 2 + ((i + n) % 7));
      end loop;
    end loop;
  end loop;

  insert into public.collections (slug, title_fa, subtitle_fa, description_fa, tone, sort_order, is_featured) values
    ('autumn-calm', 'پاییز آرام', 'رنگ‌های خاموش، لایه‌های نرم', 'مجموعه‌ای برای روزهای خنک؛ بالاپوش، بافت و اکسسوری در پالت خاکی.', 'taupe', 1, true),
    ('essentials', 'ضروریات', 'پایه‌های همیشگی کمد', 'تکه‌هایی که با هر چیزی ست می‌شوند و هر سال می‌مانند.', 'ivory', 2, false);
  insert into public.collection_products (collection_id, product_id)
    select c.id, p.id from public.collections c join public.products p on
      (c.slug = 'autumn-calm' and p.slug in ('long-wool-coat','silk-blend-blazer','pleated-midi-skirt','cashmere-scarf','merino-crewneck','leather-shoulder-bag'))
   or (c.slug = 'essentials' and p.slug in ('organic-cotton-tee','linen-shirt','tailored-trousers','satin-blouse','shirt-dress'));
end $$;

-- English content for the sample data (so the English storefront isn't empty)
update public.settings set value = to_jsonb(v.val) from (values
  ('tagline_en', 'Simple, lasting clothing'), ('announcement_en', 'Free shipping on orders over 5,000,000 Toman'),
  ('hero_title_en', 'Silence is the most beautiful garment'), ('hero_subtitle_en', 'The autumn collection: simple cuts, honest fabrics, muted colours.'),
  ('hero_cta_label_en', 'View the collection'), ('statement_en', 'Clothes you will love a little more each year.')) as v(k, val)
where public.settings.key = v.k and public.settings.value = '""'::jsonb;
update public.collections set title_en = 'Autumn Calm', subtitle_en = 'Muted colours, soft layers', description_en = 'A collection for cooler days: outerwear, knitwear and accessories in an earthy palette.' where slug = 'autumn-calm' and title_en is null;
update public.collections set title_en = 'Essentials', subtitle_en = 'The wardrobe foundations', description_en = 'Pieces that go with everything and stay for years.' where slug = 'essentials' and title_en is null;
update public.cms_pages set title_en = 'About ARAM', body_en = 'ARAM was founded on the belief that good clothes do not need to shout.

## Our approach
Simple cuts, natural fabrics and muted colours: clothes that last from one season to the next.' where slug = 'about' and title_en is null;
update public.cms_pages set title_en = 'Shipping & returns', body_en = '## Shipping
Orders are prepared and shipped after confirmation. The shipping cost is shown when you place the order.

## Returns
Contact support for return conditions. (Edit this text in Content management.)' where slug = 'shipping-returns' and title_en is null;
update public.products set material_en = case slug
  when 'long-wool-coat' then '90% wool, 10% cashmere' when 'silk-blend-blazer' then 'Silk and wool' when 'linen-shirt' then 'Pure linen'
  when 'satin-blouse' then 'Viscose satin' when 'organic-cotton-tee' then 'Organic cotton' when 'tailored-trousers' then 'Wool suiting'
  when 'pleated-midi-skirt' then 'Recycled polyester' when 'crepe-maxi-dress' then 'Viscose crepe' when 'shirt-dress' then 'Cotton poplin'
  when 'leather-shoulder-bag' then 'Natural leather' when 'cashmere-scarf' then 'Pure cashmere' when 'merino-crewneck' then 'Merino wool' end,
  care_en = 'Gentle wash or dry clean; iron on low heat.',
  description_en = case slug
  when 'long-wool-coat' then 'A straight coat with an open collar and silk lining.' when 'silk-blend-blazer' then 'A single-button blazer with a soft shoulder.'
  when 'linen-shirt' then 'A relaxed shirt with mother-of-pearl buttons.' when 'satin-blouse' then 'A fluid blouse with a plain collar.'
  when 'organic-cotton-tee' then 'A heavyweight tee with a round neck.' when 'tailored-trousers' then 'High-waisted trousers with a pressed crease.'
  when 'pleated-midi-skirt' then 'A pleated skirt with an elasticated waist.' when 'crepe-maxi-dress' then 'An A-line maxi dress with a boat neck.'
  when 'shirt-dress' then 'A belted shirt dress that falls below the knee.' when 'leather-shoulder-bag' then 'A structured bag with an adjustable strap.'
  when 'cashmere-scarf' then 'A soft, light scarf with a plain edge.' when 'merino-crewneck' then 'A fine, warm knit for layering.' end
where slug in ('long-wool-coat','silk-blend-blazer','linen-shirt','satin-blouse','organic-cotton-tee','tailored-trousers','pleated-midi-skirt','crepe-maxi-dress','shirt-dress','leather-shoulder-bag','cashmere-scarf','merino-crewneck') and material_en is null;

insert into public.aram_migrations (version) values ('seed') on conflict do nothing;
commit;
