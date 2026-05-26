-- NZ winter packing list (Trip2Talk public PACK tab)

insert into packing_items (dest, season, category, priority, label_en, label_th, weather_note_en, weather_note_th, sort_order)
values
  ('New Zealand', 'winter', 'documents', 'must_have', 'Passport (6+ months validity)', 'พาสปอร์ต (อายุ 6 เดือนขึ้นไป)', 'NZ winter: layers, waterproof jacket, warm hat', 'ฤดูหนาว NZ: ใส่เป็นชั้น ๆ กันหนาว กันฝน', 1),
  ('New Zealand', 'winter', 'documents', 'must_have', 'Travel insurance + policy copy', 'ประกันเดินทาง + สำเนากรมธรรม์', null, null, 2),
  ('New Zealand', 'winter', 'clothing', 'must_have', 'Waterproof/windproof jacket', 'แจ็กเก็ตกันฝนกันลม', null, null, 1),
  ('New Zealand', 'winter', 'clothing', 'must_have', 'Thermal base layers (2–3 sets)', 'ชุดชั้นในกันหนาว 2–3 ชุด', null, null, 2),
  ('New Zealand', 'winter', 'clothing', 'must_have', 'Comfortable waterproof walking shoes', 'รองเท้าเดินป่ากันฝน', null, null, 3),
  ('New Zealand', 'winter', 'clothing', 'nice_to_have', 'Gloves + warm beanie', 'ถุงมือ + หมวกกันหนาว', null, null, 4),
  ('New Zealand', 'winter', 'toiletries', 'must_have', 'Moisturiser + lip balm', 'ครีมบำรุงผิว + ลิปบาล์ม', null, null, 1),
  ('New Zealand', 'winter', 'electronics', 'must_have', 'NZ Type I power adapter', 'ปลั๊กแปลงไฟ Type I', null, null, 1),
  ('New Zealand', 'winter', 'electronics', 'nice_to_have', 'Power bank + cables', 'พาวเวอร์แบงก์ + สายชาร์จ', null, null, 2),
  ('New Zealand', 'winter', 'health', 'must_have', 'Medications + first-aid kit', 'ยาประจำตัว + ชุดปฐมพยาบาล', null, null, 1),
  ('New Zealand', 'winter', 'other', 'nice_to_have', 'Compact umbrella', 'ร่มพับ', null, null, 1)
on conflict do nothing;
