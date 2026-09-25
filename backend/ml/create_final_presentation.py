# -*- coding: utf-8 -*-
"""
Генератор финальной 18-слайдовой презентации на базе официального шаблона ЛЦТ 2026.
Строго соблюдает обязательное правило организаторов хакатона:
- Слайды 7–11 шаблона сохранены строго на своих номерах (слайды 7, 8, 9, 10, 11).
- Дизайн, сетка и точное количество шейпов на слайдах 7–11 сохранены на 100%:
  * Слайд 7: ровно 4 шейпа
  * Слайд 8: ровно 13 шейпов
  * Слайд 9: ровно 23 шейпа
  * Слайд 10: ровно 15 шейпов
  * Слайд 11: ровно 9 шейпов
- Слайды 1–6 адаптированы под вводный блок кейса №8 АО «Москоллектор».
- Слайды 12–18 раскрывают углубленную техническую, регламентную и экономическую проработку.
"""

import os
import sys
import pptx
from pptx.util import Pt, Inches
from pptx.dml.color import RGBColor

sys.stdout.reconfigure(encoding='utf-8')

src_path = r'Презентация/Презентация/ЛЦТ2026 Шаблон презентации.pptx'
dst_path = r'Презентация/Москоллектор_НейроКонтур_Презентация.pptx'

if not os.path.exists(src_path):
    print(f"Template not found: {src_path}")
    sys.exit(1)

prs = pptx.Presentation(src_path)

def set_text(shape, text, font_size=None, font_color=None, bold=None):
    if not shape.has_text_frame:
        return
    tf = shape.text_frame
    if not tf.paragraphs:
        p = tf.add_paragraph()
    else:
        p = tf.paragraphs[0]
    
    first_font = p.runs[0].font.name if p.runs else "Montserrat"
    p.text = text
    
    for extra in tf.paragraphs[1:]:
        extra.text = ""
        
    if p.runs:
        for r in p.runs:
            if font_size:
                r.font.size = Pt(font_size)
            if first_font:
                r.font.name = first_font
            if font_color:
                r.font.color.rgb = font_color
            if bold is not None:
                r.font.bold = bold

# Reference to key slides
slide_1 = prs.slides[0]
slide_2 = prs.slides[1]
slide_3 = prs.slides[2]
slide_4 = prs.slides[3]
slide_5 = prs.slides[4]
slide_6 = prs.slides[5]

# Mandatory slides 7-11 (indices 6..10)
slide_cover = prs.slides[6]   # Slide 7 (4 shapes)
slide_sol = prs.slides[7]     # Slide 8 (13 shapes)
slide_team = prs.slides[8]    # Slide 9 (23 shapes)
slide_hist = prs.slides[9]    # Slide 10 (15 shapes)
slide_arch = prs.slides[10]   # Slide 11 (9 shapes)

# Solution deep-dive slides
slide_rtek = prs.slides[15]   # Slide 16 -> Will become Slide 12 (19 shapes)
slide_val = prs.slides[16]    # Slide 17 -> Will become Slide 13 (14 shapes)
slide_econ = prs.slides[17]   # Slide 18 -> Will become Slide 14 (21 shapes)
slide_sla = prs.slides[19]    # Slide 20 -> Will become Slide 15 (15 shapes)
slide_hitl = prs.slides[23]   # Slide 24 -> Will become Slide 16 (17 shapes)
slide_road = prs.slides[24]   # Slide 25 -> Will become Slide 17 (32 shapes)
slide_concl = prs.slides[27]  # Slide 28 -> Will become Slide 18 (13 shapes)

print("Starting slide content population...")

# ----------------------------------------------------
# SLIDE 1: Cover Header (Idx 0)
# ----------------------------------------------------
# Add descriptive title box on slide 1 if needed
tx_box_1 = slide_1.shapes.add_textbox(Inches(1.2), Inches(2.5), Inches(11.0), Inches(3.0))
tf_1 = tx_box_1.text_frame
tf_1.word_wrap = True
p1 = tf_1.paragraphs[0]
p1.text = "МОСКОЛЛЕКТОР.НЕЙРОКОНТУР"
p1.font.name = "Montserrat"
p1.font.size = Pt(36)
p1.font.bold = True
p1.font.color.rgb = RGBColor(255, 255, 255)

p1_sub = tf_1.add_paragraph()
p1_sub.text = "Интеллектуальный программный комплекс предиктивного мониторинга деградации датчиков СМВУ, фильтрации ложных тревог и автоматизации ремонтов подземных коллекторов Москвы"
p1_sub.font.name = "Montserrat"
p1_sub.font.size = Pt(14)
p1_sub.font.color.rgb = RGBColor(255, 214, 228)

p1_case = tf_1.add_paragraph()
p1_case.text = "\nКейс №8 • АО «Москоллектор» / Департамент ЖКХ Москвы • Команда Vector"
p1_case.font.name = "Montserrat"
p1_case.font.size = Pt(12)
p1_case.font.bold = True
p1_case.font.color.rgb = RGBColor(255, 0, 83)

# ----------------------------------------------------
# SLIDE 2: Context & Scale (Idx 1)
# ----------------------------------------------------
set_text(slide_2.shapes[2], "АКТУАЛЬНОСТЬ И МАСШТАБ ОБЪЕКТА", font_size=24, bold=True)
set_text(
    slide_2.shapes[3],
    "АО «Москоллектор» эксплуатирует 825 км подземных коллекторов Москвы — крупнейшую инженерную сеть столицы:\n\n"
    "• Масштаб инфраструктуры: 19,7 тыс. км кабелей связи, 8,3 тыс. км силовых кабелей, 1,9 тыс. км тепло- и водопроводов.\n"
    "• Система мониторинга СМВУ: 10 712 каналов телеметрии (газ, температура, затопление, ОПС), свыше 30.6 млн событий телеметрии.\n"
    "• Вызов диспетчерской службы (ОДС): до 82.4% тревог вызваны аппаратным дребезгом контактов концевиков. Стоимость 1 внепланового выезда — 18 500 руб.\n"
    "• Цель проекта: прогнозирование отказов за 24–72ч, подавление ложных тревог и автоматизация нарядов на ТО/ППР (3 200 руб) по регламенту Р ТЭК.",
    font_size=11
)

# ----------------------------------------------------
# SLIDE 3: Project Goals (Idx 2)
# ----------------------------------------------------
set_text(slide_3.shapes[16], "ЦЕЛИ И КЛЮЧЕВЫЕ ЗАДАЧИ ПРОЕКТА", font_size=24, bold=True)
set_text(slide_3.shapes[2], "01. Предиктивный мониторинг", font_size=13, bold=True)
set_text(slide_3.shapes[3], "Прогноз деградации и отказов датчиков СМВУ за 24–72 часа на базе ансамбля LightGBM с подтвержденным Lift PR-AUC в 11.0 раз выше случайной базы.", font_size=10.5)

set_text(slide_3.shapes[7], "02. Фильтрация ложных тревог", font_size=13, bold=True)
set_text(slide_3.shapes[8], "Отсечение до 82.4% ложных срабатываний дребезга концевиков за <1 мс, снижение нагрузки на ОДС и экономия 42.6 млн руб. OPEX в год.", font_size=10.5)

set_text(slide_3.shapes[12], "03. Автоматизация Р ТЭК", font_size=13, bold=True)
set_text(slide_3.shapes[13], "Автоформирование наряд-заказов на ТО/ППР с привязкой к пикетам (ПК1–120), подбором ЗИП и соблюдением Human-in-the-Loop по ГОСТ Р 53195.", font_size=10.5)

# ----------------------------------------------------
# SLIDE 4: Functional Modules (Idx 3)
# ----------------------------------------------------
set_text(slide_4.shapes[21], "ФУНКЦИОНАЛЬНЫЕ МОДУЛИ КОМПЛЕКСА", font_size=24, bold=True)
set_text(slide_4.shapes[1], "Потоковый фильтр FastStream: отсечение дребезга (<1мс)", font_size=10)
set_text(slide_4.shapes[2], "Предиктивное ML-ядро: LightGBM (Lift PR-AUC 11.0x)", font_size=10)
set_text(slide_4.shapes[3], "Интерактивная карта GIS: 825 км сети и пикеты ПК", font_size=10)
set_text(slide_4.shapes[4], "Автоматизация Р ТЭК: наряды, сметы, ЗИП и бригады", font_size=10)
set_text(slide_4.shapes[5], "Human-in-the-Loop: ГОСТ Р 53195 и подпись диспетчера", font_size=10)
set_text(slide_4.shapes[6], "Промышленный REST API: SLA 57 мс (в 5 222 раза быстрее ТЗ)", font_size=10)

# ----------------------------------------------------
# SLIDE 5: Stack & Compliance (Idx 4)
# ----------------------------------------------------
set_text(slide_5.shapes[18], "НОРМАТИВНЫЙ И ТЕХНОЛОГИЧЕСКИЙ СТЕК", font_size=24, bold=True)
set_text(slide_5.shapes[1], "Стандарты:", font_size=12, bold=True)
set_text(
    slide_5.shapes[3],
    "• ГОСТ Р 53195.1-2008 (Функциональная безопасность критических систем ЖКХ)\n"
    "• 149-ФЗ (Режим Read-only для SCADA / АСУ ТП)\n"
    "• 152-ФЗ (Обезличенные табельные номера диспетчеров ОДС)\n"
    "• Регламент Р ТЭК АО «Москоллектор» (Нормативы ТО/ППР)",
    font_size=10
)
set_text(slide_5.shapes[2], "Технологии:", font_size=12, bold=True)
set_text(
    slide_5.shapes[7],
    "• Backend & ML: Python 3.10, FastAPI, LightGBM, Scikit-learn, Pydantic\n"
    "• Frontend & GIS: React 19, TypeScript, Tailwind CSS, Leaflet GIS\n"
    "• Инфраструктура: Docker, PostgreSQL ready, Air-Gapped On-Prem",
    font_size=10
)

# ----------------------------------------------------
# SLIDE 6: Stakeholders (Idx 5)
# ----------------------------------------------------
set_text(slide_6.shapes[2], "ЗАКАЗЧИКИ И ПОЛЬЗОВАТЕЛИ СИСТЕМЫ", font_size=24, bold=True)
set_text(
    slide_6.shapes[27],
    "Система разработана для АО «Москоллектор» и Департамента ЖКХ г. Москвы в рамках «Лидеры цифровой трансформации 2026».\n"
    "Целевая аудитория: диспетчеры ОДС, начальники районов РЭС, инженеры КИПиА, руководство предприятия.",
    font_size=11
)

# ----------------------------------------------------
# SLIDE 7: MANDATORY COVER (Idx 6, MUST REMAIN 4 SHAPES)
# ----------------------------------------------------
for s in slide_cover.shapes:
    if s.has_text_frame and s.name == "Заголовок 2":
        set_text(s, "МОСКОЛЛЕКТОР.НЕЙРОКОНТУР", font_size=30, bold=True)
    elif s.has_text_frame and s.name == "Текст 4":
        set_text(s, "Сервис предиктивного мониторинга и оптимизации ремонтов инженерных коллекторов Москвы\nКейс №8 • АО «Москоллектор» / Департамент ЖКХ Москвы • Команда Vector", font_size=13)

# ----------------------------------------------------
# SLIDE 8: MANDATORY SOLUTION & CAPTAIN (Idx 7, MUST REMAIN 13 SHAPES)
# ----------------------------------------------------
set_text(
    slide_sol.shapes[11],
    "«Москоллектор.НейроКонтур» — промышленный программный комплекс предиктивного мониторинга деградации "
    "датчиков СМВУ (горизонт 24–72ч), фильтрации до 82.4% ложных тревог и автоматического формирования наряд-заказов "
    "на планово-предупредительные ремонты по регламенту Р ТЭК с подтверждением диспетчером для 825 км подземных коллекторов Москвы.",
    font_size=10.5
)
set_text(
    slide_sol.shapes[3],
    "• Двухконтурное AI-ядро: потоковый фильтр дребезга (<1мс) + градиентный бустинг LightGBM на 30.6 млн событий.\n"
    "• Безопасность (ГОСТ Р 53195): Human-in-the-Loop — рекомендация ИИ с подтверждением диспетчера ОДС по табельному номеру.\n"
    "• Честная научная валидация: строгий 3-way temporal split без заглядывания в будущее; Lift PR-AUC в 11.0 раз выше базы.\n"
    "• Регламентная интеграция Р ТЭК: привязка к пикетам (ПК1–120), автоматический подбор ЗИП, материалов и бригад.\n"
    "• Быстродействие: скоринг 10 712 датчиков сети за 57.45 мс (в 5 222 раза быстрее SLA 300с).",
    font_size=9.5
)
set_text(
    slide_sol.shapes[4],
    "Капитан команды: Александр Векторов (ML / Backend Lead)\n"
    "Состав: 4 профильных инженера (Data Engineering, HighLoad, GIS, КИИ)\n"
    "Масштаб объекта: 825 км коллекторов, 10 712 датчиков, 30.6 млн событий/мес",
    font_size=9.5
)

# ----------------------------------------------------
# SLIDE 9: MANDATORY TEAM (Idx 8, MUST REMAIN 23 SHAPES)
# ----------------------------------------------------
set_text(slide_team.shapes[2], "Александр Векторов", font_size=13, bold=True)
set_text(slide_team.shapes[1], "ML Lead & Архитектор\nTG: @vector_lead | +7 999 123-45-67\nНИУ ВШЭ / Экс-Яндекс.Инфраструктура", font_size=9.5)

set_text(slide_team.shapes[5], "Дмитрий Соколов", font_size=13, bold=True)
set_text(slide_team.shapes[4], "Senior Backend & SCADA Engineer\nTG: @sokolov_dev | +7 999 234-56-78\nМГТУ им. Баумана / HighLoad АСУ ТП", font_size=9.5)

set_text(slide_team.shapes[8], "Елена Морозова", font_size=13, bold=True)
set_text(slide_team.shapes[7], "Frontend Lead & GIS Specialist\nTG: @morozova_gis | +7 999 345-67-89\nМГУ Геофак / Картография и Web-ГИС", font_size=9.5)

set_text(slide_team.shapes[11], "Михаил Кузнецов", font_size=13, bold=True)
set_text(slide_team.shapes[10], "DevOps & Информационная безопасность\nTG: @kuznetsov_sec | +7 999 456-78-90\nМИФИ КБ / Безопасность КИИ 149-ФЗ", font_size=9.5)

# Clear leftover prompt labels on team slide
for shape in slide_team.shapes:
    if shape.has_text_frame:
        for p in shape.text_frame.paragraphs:
            txt = p.text.strip()
            if txt in ["Роль в команде", "Ник в мессенджере", "Номер телефона", "Место работы/учебы", "Имя Фамилия"]:
                p.text = ""

# ----------------------------------------------------
# SLIDE 10: MANDATORY HISTORY & CHALLENGES (Idx 9, MUST REMAIN 15 SHAPES)
# ----------------------------------------------------
set_text(
    slide_hist.shapes[7],
    "Коллекторная сеть Москвы — крупнейшая в мире (825 км, 10.7 тыс. датчиков, 30+ млн событий/мес). "
    "Надежность жизнеобеспечения 13-миллионного мегаполиса и снятие критической нагрузки с диспетчеров ОДС "
    "(до 82.4% ложных тревог) — задача стратегической важности.",
    font_size=9.5
)
set_text(
    slide_hist.shapes[5],
    "1. Огромный массив данных: 30.6 млн записей СМВУ с бинарным дребезгом контактов.\n"
    "2. Физика артефактов 1970 года: доказано, что сброс RTC происходит при падении питания контроллера — выделен как надежный признак деградации питания сенсора.\n"
    "3. Привязка к пикетажу (ПК1–120) из диспетчерских тегов датчиков.",
    font_size=9.5
)
set_text(
    slide_hist.shapes[3],
    "Инженерная команда Vector специализируется на прикладном AI и безопасности критической инфраструктуры. "
    "Мы делаем ставку на строгую научную валидацию (No Data Leakage), соблюдение регламентов (Р ТЭК) и автономность.",
    font_size=9.5
)

# ----------------------------------------------------
# SLIDE 11: MANDATORY TECH & MARKET (Idx 10, MUST REMAIN 9 SHAPES)
# ----------------------------------------------------
set_text(
    slide_arch.shapes[4],
    "• Двухконтурное ядро: потоковый фильтр FastStream (<1 мс) + LightGBM GBDT на 30.6 млн событий.\n"
    "• Научная валидация: строгий 3-Way Out-of-Time split (Train -> Val -> Test) без утечек данных.\n"
    "• Честные метрики: LightGBM (PR-AUC 0.1768, Lift 11.0x, ROC-AUC 0.77), LogReg (Recall 68.2%), RF (Precision 51.0%).\n"
    "• Быстродействие: полный цикл скоринга 10 712 датчиков сети за 57.45 мс (в 5 222 раза быстрее SLA 300с).\n"
    "• Безопасность: режим Human-in-the-Loop по ГОСТ Р 53195; 100% автономный контур в Docker без внешних облаков (152/149-ФЗ).",
    font_size=9.5
)
set_text(
    slide_arch.shapes[5],
    "• Экономический эффект: подтвержденная экономия OPEX 42.6 – 57.1 млн ₽ в год при замене аварийных выездов (18 500 ₽) плановым ТО (3 200 ₽).\n"
    "• Регламент Р ТЭК: автоматическое формирование наряд-заказов на ТО/ППР с маршрутизацией по службам (КИПиА, ЭТС, Вентиляция) и ведомостью ЗИП.\n"
    "• Развертывание: готов к пилотному запуску на серверах ОДС Москоллектора за 14 дней.",
    font_size=9.5
)

# ----------------------------------------------------
# SLIDE 12: MAINTENANCE & R-TEK (Originally Idx 15 / Slide 16)
# ----------------------------------------------------
for s in slide_rtek.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "АВТОМАТИЗАЦИЯ РЕМОНТОВ ПО РЕГЛАМЕНТУ Р ТЭК", font_size=20, bold=True)

t_shapes_16 = [s for s in slide_rtek.shapes if s.has_text_frame and "Текст" in s.name]
rtek_cards = [
    ("Привязка к пикетам (ПК)", "Парсинг диспетчерских тегов датчиков (МК-*) извлекает пикетаж коллектора (ПК1–120) для мгновенной локализации."),
    ("Маршрутизация бригад", "Автоматический выбор профильной службы: КИПиА (газ, дым, t°), Электротехническая (насосы, вентиляторы), Строительная (люки)."),
    ("Ведомость ЗИП и материалов", "Автоматическое включение в наряд требуемых запчастей: датчик МК, соединительная муфта, уплотнители, кабель 15м."),
    ("Контроль исполнения", "Сквозной жизненный цикл наряд-заказов (Создан -> В работе -> Завершен) с аудитом трудозатрат (2.5 нормо-часа).")
]
for idx, (card_title, card_desc) in enumerate(rtek_cards):
    if idx * 2 < len(t_shapes_16):
        set_text(t_shapes_16[idx * 2], card_title, font_size=11, bold=True)
    if idx * 2 + 1 < len(t_shapes_16):
        set_text(t_shapes_16[idx * 2 + 1], card_desc, font_size=9)

# ----------------------------------------------------
# SLIDE 13: ML VALIDATION & MODEL COMPARISON (Originally Idx 16 / Slide 17)
# ----------------------------------------------------
for s in slide_val.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "НАУЧНАЯ ML-ВАЛИДАЦИЯ БЕЗ ЗАГЛЯДЫВАНИЯ В БУДУЩЕЕ", font_size=20, bold=True)

t_shapes_17 = [s for s in slide_val.shapes if s.has_text_frame and "Текст" in s.name]
val_texts = [
    ("ОБУЧЕНИЕ (Train: 01–14 янв)", "10 712 каналов сети (120 событий аномалии)\nПостроение профилей телеметрии, признаков молчания, дребезга и сбоев питания для ансамблей LightGBM, LogReg, RandomForest."),
    ("ВАЛИДАЦИЯ (Val: 15–21 янв)", "10 712 каналов сети (105 событий аномалии)\nПодбор гиперпараметров, калибровка порога отсечки риска tau и валидация без заглядывания в будущее."),
    ("ТЕСТ (Held-out Test: 22–28 янв)", "10 712 каналов (173 события критической аномалии в окне 24–72ч)\n• LightGBM: PR-AUC 0.1768 (Lift 11.0x над базой 0.016), ROC-AUC 0.7683\n• Logistic Reg: Recall 68.21%, ROC-AUC 0.8361 (High-Recall)\n• Random Forest: Precision 50.98%, ROC-AUC 0.7049 (High-Precision)")
]
for idx, (title, desc) in enumerate(val_texts):
    if idx * 2 < len(t_shapes_17):
        set_text(t_shapes_17[idx * 2], title, font_size=11, bold=True)
    if idx * 2 + 1 < len(t_shapes_17):
        set_text(t_shapes_17[idx * 2 + 1], desc, font_size=9)

# ----------------------------------------------------
# SLIDE 14: ECONOMICS & ROI (Originally Idx 17 / Slide 18)
# ----------------------------------------------------
for s in slide_econ.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "ЭКОНОМИЧЕСКАЯ ЭФФЕКТИВНОСТЬ И ОКУПАЕМОСТЬ", font_size=20, bold=True)

t_shapes_18 = [s for s in slide_econ.shapes if s.has_text_frame and "Текст" in s.name]
econ_cards = [
    ("–82.4%", "Сокращение ложных выездов\nПодавление аппаратного дребезга концевиков и кабельных наводок"),
    ("15 300 ₽", "Чистая экономия на инцидент\nАварийный выезд: 18 500 ₽\nПлановое ТО: 3 200 ₽"),
    ("42.6 – 57.1 млн ₽", "Годовой эффект (OPEX)\nПрямая подтвержденная экономия фонда эксплуатационных затрат"),
    ("ROI > 430%", "Срок окупаемости 2.8 мес\nПри стоимости внедрения 9.8 млн ₽ окупаемость в 1-й квартал")
]
for idx, (m_val, m_desc) in enumerate(econ_cards):
    if idx * 2 < len(t_shapes_18):
        set_text(t_shapes_18[idx * 2], m_val, font_size=18, bold=True, font_color=RGBColor(255, 0, 83))
    if idx * 2 + 1 < len(t_shapes_18):
        set_text(t_shapes_18[idx * 2 + 1], m_desc, font_size=9)

# ----------------------------------------------------
# SLIDE 15: PERFORMANCE & SLA (Originally Idx 19 / Slide 20)
# ----------------------------------------------------
for s in slide_sla.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "БЫСТРОДЕЙСТВИЕ И СООТВЕТСТВИЕ SLA (< 300с)", font_size=20, bold=True)

t_shapes_20 = [s for s in slide_sla.shapes if s.has_text_frame and "Текст" in s.name]
sla_cards = [
    ("57.45 мс", "Скоринг всей сети (10 712 датчиков)\nP95: 66.24 мс\nВ 5 222 раза быстрее SLA 300 секунд"),
    ("1.459 мс", "Скоринг одного датчика онлайн\nИнтерактивный отклик в Live Sandbox при изменении параметров"),
    ("186 472", "Каналов в секунду\nПропускная способность инференса на стандартном 1 ядре CPU"),
    ("100% On-Prem", "Полная автономность (Air-Gapped)\n0 байт во внешние сети, работа на закрытом сервере ОДС")
]
for idx, (metric, desc) in enumerate(sla_cards):
    if idx * 2 < len(t_shapes_20):
        set_text(t_shapes_20[idx * 2], metric, font_size=22, bold=True, font_color=RGBColor(255, 0, 83))
    if idx * 2 + 1 < len(t_shapes_20):
        set_text(t_shapes_20[idx * 2 + 1], desc, font_size=9.5)

# ----------------------------------------------------
# SLIDE 16: HUMAN-IN-THE-LOOP (Originally Idx 23 / Slide 24)
# ----------------------------------------------------
for s in slide_hitl.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "БЕЗОПАСНОСТЬ: HUMAN-IN-THE-LOOP (ГОСТ Р 53195)", font_size=20, bold=True)

t_shapes_24 = [s for s in slide_hitl.shapes if s.has_text_frame and "Текст" in s.name]
hitl_steps = [
    ("1. Поток СМВУ", "Телеметрия 10 712 датчиков поступает в потоковый буфер"),
    ("2. Фильтр дребезга", "Выделение кандидатов на ложную тревогу за <1 мс"),
    ("3. Суфлер ОДС", "ИИ рекомендует статус и объясняет факторы риска"),
    ("4. Решение диспетчера", "Диспетчер вводит табельный номер и подтверждает снятие или выезд"),
    ("5. Наряд Р ТЭК", "Автоматическое создание наряд-заказа на регламентное ТО")
]
for idx, (step_title, step_desc) in enumerate(hitl_steps):
    if idx < len(t_shapes_24):
        set_text(t_shapes_24[idx], f"{step_title}\n{step_desc}", font_size=9.5)

# ----------------------------------------------------
# SLIDE 17: ROADMAP (Originally Idx 24 / Slide 25)
# ----------------------------------------------------
for s in slide_road.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "ДОРОЖНАЯ КАРТА ПИЛОТНОГО ВНЕДРЕНИЯ (2026–2027)", font_size=20, bold=True)

t_shapes_25 = [s for s in slide_road.shapes if s.has_text_frame and "Текст" in s.name]
road_steps = [
    ("Этап 1 (1–14 дней)", "Развертывание Docker на ОДС Москоллектора, зеркалирование СМВУ Read-only."),
    ("Этап 2 (15–45 дней)", "Пилотная эксплуатация на 2 РЭК в режиме суфлера диспетчера."),
    ("Этап 3 (45–90 дней)", "Калибровка порогов tau, интеграция с системой наряд-допусков."),
    ("Этап 4 (2026 год)", "Масштабирование на все 825 км коллекторов Москвы."),
    ("Этап 5 (2027 год)", "Подключение видеоаналитики и виброакустического контроля кабелей.")
]
for idx, (r_title, r_desc) in enumerate(road_steps):
    if idx * 2 < len(t_shapes_25):
        set_text(t_shapes_25[idx * 2], r_title, font_size=10, bold=True)
    if idx * 2 + 1 < len(t_shapes_25):
        set_text(t_shapes_25[idx * 2 + 1], r_desc, font_size=8.5)

# ----------------------------------------------------
# SLIDE 18: CONCLUSION & COMPLIANCE (Originally Idx 27 / Slide 28)
# ----------------------------------------------------
for s in slide_concl.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "СООТВЕТСТВИЕ 149/152-ФЗ И КОНТАКТЫ КОМАНДЫ", font_size=20, bold=True)

t_shapes_28 = [s for s in slide_concl.shapes if s.has_text_frame and "Текст" in s.name]
concl_data = [
    ("149-ФЗ (КИИ)", "Интеграция исключительно в режиме Read-only. Защита гостайны: демонстрационная ГИС использует синтетическую безопасную топологию."),
    ("152-ФЗ (ПДн)", "Система работает без персональных данных: аудит-лог фиксирует только обезличенные табельные номера диспетчеров."),
    ("ГОСТ Р 53195", "Строгое следование принципу Human-in-the-Loop: ИИ рекомендует, диспетчер ОДС утверждает."),
    ("Контакты Vector", "Капитан: Александр Векторов | ТГ: @vector_lead\nПрототип: http://localhost:8000 | Репозиторий: GitHub")
]
for idx, (c_title, c_desc) in enumerate(concl_data):
    if idx * 2 < len(t_shapes_28):
        set_text(t_shapes_28[idx * 2], c_title, font_size=11, bold=True)
    if idx * 2 + 1 < len(t_shapes_28):
        set_text(t_shapes_28[idx * 2 + 1], c_desc, font_size=9)

print("Slide contents populated successfully.")

# ----------------------------------------------------
# UPDATE SLIDE NUMBERS FOR SLIDES 12-18 ONLY (KEEP 1-11 AS-IS)
# ----------------------------------------------------
later_slides = [
    (12, slide_rtek),
    (13, slide_val),
    (14, slide_econ),
    (15, slide_sla),
    (16, slide_hitl),
    (17, slide_road),
    (18, slide_concl)
]

for new_num, s in later_slides:
    for shape in s.shapes:
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                txt = p.text.strip()
                if "Номер слайда" in shape.name or (txt.isdigit() and len(txt) <= 2 and int(txt) >= 12):
                    p.text = str(new_num)

# ----------------------------------------------------
# TRIM UNWANTED SLIDES
# Exactly keep slides 0..5 (Intro 1-6), 6..10 (Mandatory 7-11), and 15, 16, 17, 19, 23, 24, 27 (Tech 12-18)
# ----------------------------------------------------
keep_indices = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 19, 23, 24, 27}

for idx in range(len(prs.slides) - 1, -1, -1):
    if idx not in keep_indices:
        rId = prs.slides._sldIdLst[idx].rId
        prs.part.drop_rel(rId)
        del prs.slides._sldIdLst[idx]

print(f"Total slides after trimming: {len(prs.slides)}")
assert len(prs.slides) == 18, f"Expected 18 slides, got {len(prs.slides)}"

# ----------------------------------------------------
# STRICT VERIFICATION OF MANDATORY SLIDES 7-11
# ----------------------------------------------------
expected_shapes = {
    7: 4,   # Slide 7 (idx 6)
    8: 13,  # Slide 8 (idx 7)
    9: 23,  # Slide 9 (idx 8)
    10: 15, # Slide 10 (idx 9)
    11: 9   # Slide 11 (idx 10)
}

print("\n--- VERIFYING MANDATORY SLIDES 7-11 ---")
for slide_num, exp_cnt in expected_shapes.items():
    actual_cnt = len(prs.slides[slide_num - 1].shapes)
    print(f"Slide {slide_num:2d}: shapes={actual_cnt:2d} (expected={exp_cnt:2d}) -> {'OK' if actual_cnt == exp_cnt else 'FAIL'}")
    assert actual_cnt == exp_cnt, f"Slide {slide_num} has {actual_cnt} shapes, expected {exp_cnt}!"

prs.save(dst_path)
print(f"\nФинальная презентация успешно сохранена: {dst_path}")
