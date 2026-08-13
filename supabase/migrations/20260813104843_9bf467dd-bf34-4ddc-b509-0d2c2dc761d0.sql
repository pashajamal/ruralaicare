INSERT INTO public.first_aid_protocols (condition_name, keywords, otc_medicine, protocol_text) VALUES
('Emergency stabilization — severe bleeding', ARRAY['bleeding','blood loss','haemorrhage','hemorrhage','cut','wound','stab','laceration','trauma','injury'], NULL,
'1. Call for transport to the nearest hospital immediately; do not delay.
2. Wear gloves if available, then press firmly on the bleeding point with a clean cloth or sterile pad.
3. Keep constant, direct pressure — do not lift the pad to check; add another layer on top if it soaks through.
4. If a limb is bleeding, raise it above the level of the heart unless a fracture is suspected.
5. Lay the patient flat and keep them warm with a blanket; do not give food or drink.
6. Watch breathing and responsiveness every few minutes and record the time pressure was started.'),
('Emergency stabilization — breathing difficulty', ARRAY['difficulty breathing','breathless','shortness of breath','gasping','chest pain','wheeze','choking','cyanosis','blue lips','low spo2'], NULL,
'1. Call for transport to the nearest hospital immediately; do not delay.
2. Sit the patient upright, leaning slightly forward — never lay them flat.
3. Loosen tight clothing around the neck and chest and keep the surrounding area calm and well ventilated.
4. Keep the airway clear: remove any visible obstruction from the mouth, do not sweep blindly.
5. Give oxygen only if it is available at the centre and you are trained to use it.
6. If the patient carries a prescribed inhaler, allow them to use their own device as they normally would.
7. Monitor SpO2, pulse and level of response every few minutes until transport arrives.'),
('Emergency stabilization — high fever with red-flag signs', ARRAY['high fever','very high temperature','convulsion','seizure','fits','confusion','drowsy','unconscious','stiff neck','rash','dehydration'], NULL,
'1. Call for transport to the nearest hospital immediately; do not delay.
2. Move the patient to a cool, shaded, well-ventilated place and remove extra clothing and blankets.
3. Sponge the skin with room-temperature (not cold) water; do not use ice or alcohol.
4. If the patient is conscious and able to swallow, offer small sips of clean water only.
5. If a convulsion occurs, protect the head, turn the patient onto their side and clear the area — do not put anything in the mouth or restrain them.
6. Record temperature, pulse and level of response every few minutes for the receiving facility.'),
('Emergency stabilization — general (while awaiting transport)', ARRAY['emergency','urgent','critical','collapse','unconscious','severe'], NULL,
'1. Call for transport to the nearest hospital immediately; do not delay.
2. Keep the patient still and lying comfortably; do not allow them to walk unnecessarily.
3. Keep the airway clear and check breathing and responsiveness every few minutes.
4. If the patient is unresponsive but breathing, place them in the recovery position on their side.
5. Keep the patient warm with a blanket and protect them from sun, cold and crowding.
6. Do not give any food, drink or medicine.
7. Record vitals, timings and any change in condition to hand over to the receiving facility.');