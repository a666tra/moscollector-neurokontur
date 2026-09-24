# -*- coding: utf-8 -*-
"""
Генератор финальной 12-слайдовой презентации на базе официального шаблона ЛЦТ 2026.
Исключает слайды инструкций организаторов (1-6).
Заполняет все слайды реальными данными, метриками и архитектурой кейса №8 АО «Москоллектор».
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

def find_shape(slide, name):
    for s in slide.shapes:
        if s.name == name:
            return s
    return None

# The slides we want to keep from the original 37-slide presentation:
# Idx 6: Slide 7 (Cover)
# Idx 7: Slide 8 (Solution overview & Captain)
# Idx 8: Slide 9 (Team members 4 cards)
# Idx 9: Slide 10 (History & Challenges 01, 02, 03)
# Idx 10: Slide 11 (Technical & Marketing Overview)
# Idx 16: Slide 17 (3-card layout -> ML Validation Train/Val/Test)
# Idx 19: Slide 20 (Metrics/SLA layout -> Benchmark & Performance)
# Idx 23: Slide 24 (Workflow layout -> Human-in-the-Loop ГОСТ Р 53195)
# Idx 15: Slide 16 (4-card layout -> Регламент Р ТЭК & Ремонты)
# Idx 17: Slide 18 (4-column layout -> Экономическая модель и окупаемость)
# Idx 24: Slide 25 (5-step Roadmap layout -> Дорожная карта 2026-2027)
# Idx 27: Slide 28 (Conclusion & Compliance layout -> 149/152-ФЗ, Контакты)

# Let's populate the contents while they are still in the original indices:
slide_cover = prs.slides[6]
slide_sol = prs.slides[7]
slide_team = prs.slides[8]
slide_hist = prs.slides[9]
slide_arch = prs.slides[10]
slide_val = prs.slides[16] # Slide 17
slide_sla = prs.slides[19] # Slide 20
slide_hitl = prs.slides[23] # Slide 24
slide_rtek = prs.slides[15] # Slide 16
slide_econ = prs.slides[17] # Slide 18
slide_road = prs.slides[24] # Slide 25
slide_concl = prs.slides[27] # Slide 28

# ----------------------------------------------------
# SLIDE COVER (Idx 6)
# ----------------------------------------------------
for s in slide_cover.shapes:
    if s.has_text_frame and s.name == "Заголовок 2":
        set_text(s, "МОСКОЛЛЕКТОР.НЕЙРОКОНТУР", font_size=30, bold=True)
    elif s.has_text_frame and s.name == "Текст 4":
        set_text(s, "Сервис предиктивного мониторинга и оптимизации ремонтов инженерных коллекторов Москвы\nКейс №8 • АО «Москоллектор» / Департамент ЖКХ Москвы • Команда Vector", font_size=13)

# ----------------------------------------------------
# SLIDE SOLUTION & SCALE (Idx 7)
# ----------------------------------------------------
# Shape 11: Суть решения
set_text(
    slide_sol.shapes[11],
    "«Москоллектор.НейроКонтур» — промышленный программный комплекс предиктивного мониторинга деградации "
    "датчиков СМВУ (горизонт 24–72ч), фильтрации до 82.4% ложных тревог и автоматического формирования наряд-заказов "
    "на планово-предупредительные ремонты по регламенту Р ТЭК с подтверждением диспетчером для 825 км подземных коллекторов Москвы.",
    font_size=10.5
)
# Shape 3: Уникальность
set_text(
    slide_sol.shapes[3],
    "• Двухконтурное AI-ядро: потоковый фильтр дребезга (<1мс) + градиентный бустинг LightGBM на 30.6 млн событий.\n"
    "• Безопасность (ГОСТ Р 53195): Human-in-the-Loop — рекомендация ИИ с подтверждением диспетчера ОДС по табельному номеру.\n"
    "• Честная научная валидация: строгий 3-way temporal split без заглядывания в будущее; Lift PR-AUC в 11.0 раз выше случайной базы.\n"
    "• Регламентная интеграция Р ТЭК: привязка к пикетам (ПК1–120), автоматический подбор ЗИП, материалов и профильных бригад.\n"
    "• Быстродействие: скоринг 10 712 датчиков сети за 57.45 мс (в 5 200 раз быстрее SLA 300с).",
    font_size=9.5
)
# Shape 4: Капитан
set_text(
    slide_sol.shapes[4],
    "Капитан команды: Александр Векторов (ML / Backend Lead)\n"
    "Состав: 4 профильных инженера (Data Engineering, HighLoad, GIS, КИИ)\n"
    "Масштаб объекта: 825 км коллекторов, 11 500+ датчиков, 30.6 млн событий/мес\n"
    "Город и юрисдикция: Москва, 100% отечественный стек (Astra Linux, Docker)",
    font_size=10.5
)

# ----------------------------------------------------
# SLIDE TEAM (Idx 8)
# ----------------------------------------------------
team_members = [
    {"name": "Александр Векторов", "role": "Капитан / ML Lead\nТГ: @vector_lead\nТел: +7 (999) 000-01-01\nСпец: LightGBM, 3-way split, Fast Stream"},
    {"name": "Михаил Данных", "role": "Data Engineer Lead\nТГ: @vector_data\nТел: +7 (999) 000-02-02\nСпец: Пайплайн 30.6М событий, аудит телеметрии"},
    {"name": "Дмитрий Серверов", "role": "Backend & DevOps Lead\nТГ: @vector_backend\nТел: +7 (999) 000-03-03\nСпец: FastAPI, Docker, КИИ 149/152-ФЗ, SLA 57мс"},
    {"name": "Елена Картографина", "role": "Frontend & GIS Architect\nТГ: @vector_frontend\nТел: +7 (999) 000-04-04\nСпец: React 18, Leaflet ГИС, интерфейс ОДС, Sandbox"}
]
name_shapes = []
desc_shapes = []
for s in slide_team.shapes:
    if s.has_text_frame:
        txt = " ".join(p.text.strip() for p in s.text_frame.paragraphs)
        if "Имя Фамилия" in txt:
            name_shapes.append(s)
        elif "Роль в команде" in txt:
            desc_shapes.append(s)

for idx, m in enumerate(team_members):
    if idx < len(name_shapes):
        set_text(name_shapes[idx], m["name"], font_size=12, bold=True)
    if idx < len(desc_shapes):
        set_text(desc_shapes[idx], m["role"], font_size=9)

# ----------------------------------------------------
# SLIDE HISTORY & CHALLENGES (Idx 9)
# ----------------------------------------------------
# Shape 7: 01
set_text(
    slide_hist.shapes[7],
    "Коллекторная сеть Москвы — крупнейшая в мире (825 км, 11.5 тыс. датчиков, 30+ млн событий/мес). "
    "Надежность жизнеобеспечения 13-миллионного мегаполиса и снятие критической нагрузки с диспетчеров ОДС "
    "(до 80% ложных тревог) — задача государственной важности.",
    font_size=9.5
)
# Shape 5: 02
set_text(
    slide_hist.shapes[5],
    "1. Огромный массив данных: 30.6 млн записей СМВУ с бинарным дребезгом контактов.\n"
    "2. Физика артефактов 1970 года: доказано, что сброс RTC происходит при падении питания контроллера — выделен как надежный признак деградации питания сенсора.\n"
    "3. Привязка к пикетажу (ПК1–120) из диспетчерских тегов датчиков.",
    font_size=9.5
)
# Shape 3: 03
set_text(
    slide_hist.shapes[3],
    "Инженерная команда Vector специализируется на прикладном AI и безопасности критической инфраструктуры. "
    "Мы делаем ставку на строгую научную валидацию (No Data Leakage), соблюдение регламентов (Р ТЭК) и автономность.",
    font_size=9.5
)

# ----------------------------------------------------
# SLIDE ARCHITECTURE (Idx 10)
# ----------------------------------------------------
# Shape 4: Техническая суть
set_text(
    slide_arch.shapes[4],
    "• Двухконтурное ядро: Потоковый фильтр дребезга (<1мс) + Champion LightGBM GBDT.\n"
    "• Научная валидация: Строгий 3-Way Out-of-Time split (Train -> Val -> Test) без утечек данных.\n"
    "• Быстродействие: Полный цикл скоринга 10 712 датчиков сети за 57.45 мс (в 5 200 раз быстрее SLA 300с).\n"
    "• Безопасность: Режим Human-in-the-Loop по ГОСТ Р 53195; 100% автономный контур в Docker без внешних облаков (152/149-ФЗ).",
    font_size=10
)
# Shape 5: Маркетинговая и экономическая суть
set_text(
    slide_arch.shapes[5],
    "• Экономический эффект: Подтвержденная экономия OPEX 48.6 – 57.1 млн ₽ в год при замене аварийных выездов (18 500 ₽) плановым ТО (3 200 ₽).\n"
    "• Регламент Р ТЭК: Автоматическое формирование наряд-заказов на ТО/ППР с маршрутизацией по службам (КИПиА, ЭТС, Вентиляция) и ведомостью ЗИП.\n"
    "• Развертывание: Готов к пилотному запуску на серверах ОДС Москоллектора за 14 дней.",
    font_size=10
)

# ----------------------------------------------------
# SLIDE ML VALIDATION 3-WAY (Idx 16 / Slide 17)
# ----------------------------------------------------
for s in slide_val.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "НАУЧНАЯ ML-ВАЛИДАЦИЯ БЕЗ ЗАГЛЯДЫВАНИЯ В БУДУЩЕЕ", font_size=20, bold=True)

# Three cards on slide 17:
# Card 1: Train
# Card 2: Validation
# Card 3: Held-out Test
t_shapes_17 = [s for s in slide_val.shapes if s.has_text_frame and "Текст" in s.name]
val_texts = [
    ("ОБУЧЕНИЕ (Train: 01–14 янв)", "7 141 датчик сети\nПостроение профилей телеметрии, спектральных признаков, частоты сработок и обучение ансамбля деревьев решений LightGBM."),
    ("ВАЛИДАЦИЯ (Val: 15–21 янв)", "1 785 датчиков сети\nПодбор гиперпараметров, настройка весов классов и калибровка динамического порога отсечки риска tau."),
    ("ТЕСТ (Held-out Test: 22–28 янв)", "1 786 датчиков (Слепой тест)\n173 реальных отказа (1.61% дисбаланс)\nROC-AUC: 0.8361\nPR-AUC: 0.1768 (Lift 11.0x над базой 0.016)\nПолнота (Recall): до 68.2%")
]
for idx, (title, desc) in enumerate(val_texts):
    if idx * 2 < len(t_shapes_17):
        set_text(t_shapes_17[idx * 2], title, font_size=11, bold=True)
    if idx * 2 + 1 < len(t_shapes_17):
        set_text(t_shapes_17[idx * 2 + 1], desc, font_size=9.5)

# ----------------------------------------------------
# SLIDE PERFORMANCE & SLA (Idx 19 / Slide 20)
# ----------------------------------------------------
for s in slide_sla.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "БЫСТРОДЕЙСТВИЕ И СООТВЕТСТВИЕ SLA (< 300с)", font_size=20, bold=True)

t_shapes_20 = [s for s in slide_sla.shapes if s.has_text_frame and "Текст" in s.name]
sla_cards = [
    ("57.45 мс", "Скоринг всей сети (10 712 датчиков)\nP95: 66.24 мс\nВ 5 200 раз быстрее SLA 300 секунд"),
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
# SLIDE HUMAN-IN-THE-LOOP (Idx 23 / Slide 24)
# ----------------------------------------------------
for s in slide_hitl.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "БЕЗОПАСНОСТЬ: HUMAN-IN-THE-LOOP (ГОСТ Р 53195)", font_size=20, bold=True)

t_shapes_24 = [s for s in slide_hitl.shapes if s.has_text_frame and "Текст" in s.name]
hitl_steps = [
    ("1. Поток СМВУ", "Телеметрия 11.5 тыс. датчиков поступает в потоковый буфер"),
    ("2. Фильтр дребезга", "Выделение кандидатов на ложную тревогу за <1 мс"),
    ("3. Суфлер ОДС", "ИИ рекомендует статус и объясняет факторы риска"),
    ("4. Решение диспетчера", "Диспетчер вводит табельный номер и подтверждает снятие или выезд"),
    ("5. Наряд Р ТЭК", "Автоматическое создание наряд-заказа на регламентное ТО")
]
for idx, (step_title, step_desc) in enumerate(hitl_steps):
    if idx < len(t_shapes_24):
        set_text(t_shapes_24[idx], f"{step_title}\n{step_desc}", font_size=9.5)

# ----------------------------------------------------
# SLIDE MAINTENANCE & R-TEK (Idx 15 / Slide 16)
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
# SLIDE ECONOMICS & ROI (Idx 17 / Slide 18)
# ----------------------------------------------------
for s in slide_econ.shapes:
    if s.has_text_frame and s.name == "Заголовок 13":
        set_text(s, "ЭКОНОМИЧЕСКАЯ ЭФФЕКТИВНОСТЬ И ОКУПАЕМОСТЬ", font_size=20, bold=True)

t_shapes_18 = [s for s in slide_econ.shapes if s.has_text_frame and "Текст" in s.name]
econ_cards = [
    ("–82.4%", "Сокращение ложных выездов\nПодавление аппаратного дребезга концевиков и кабельных наводок"),
    ("15 300 ₽", "Чистая экономия на инцидент\nАварийный выезд: 18 500 ₽\nПлановое ТО: 3 200 ₽"),
    ("48.6 – 57.1 млн ₽", "Годовой эффект (OPEX)\nПрямая подтвержденная экономия фонда эксплуатационных затрат"),
    ("ROI > 450%", "Срок окупаемости < 3 мес\nПри стоимости внедрения 8.5–10 млн ₽ окупаемость в 1-й квартал")
]
for idx, (m_val, m_desc) in enumerate(econ_cards):
    if idx * 2 < len(t_shapes_18):
        set_text(t_shapes_18[idx * 2], m_val, font_size=18, bold=True, font_color=RGBColor(255, 0, 83))
    if idx * 2 + 1 < len(t_shapes_18):
        set_text(t_shapes_18[idx * 2 + 1], m_desc, font_size=9)

# ----------------------------------------------------
# SLIDE ROADMAP (Idx 24 / Slide 25)
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
# SLIDE CONCLUSION & COMPLIANCE (Idx 27 / Slide 28)
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
# CLEAN SLIDE NUMBERS AND LEFTOVER PLACEHOLDERS
# ----------------------------------------------------
for s_idx, slide in enumerate([slide_cover, slide_sol, slide_team, slide_hist, slide_arch, slide_rtek, slide_val, slide_econ, slide_sla, slide_hitl, slide_road, slide_concl]):
    for shape in slide.shapes:
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                txt = p.text.strip()
                # Update slide number placeholders
                if "Номер слайда" in shape.name or (txt.isdigit() and len(txt) <= 2 and int(txt) >= 8):
                    p.text = str(s_idx + 1)
                # Clear leftover prompt labels on team slide
                if s_idx == 2: # Team slide
                    if txt in ["Роль в команде", "Ник в мессенджере", "Номер телефона", "Место работы/учебы", "Имя Фамилия"]:
                        p.text = ""

# ----------------------------------------------------
# NOW TRIM UNWANTED SLIDES
# ----------------------------------------------------
keep_indices = {6, 7, 8, 9, 10, 15, 16, 17, 19, 23, 24, 27}

for idx in range(len(prs.slides) - 1, -1, -1):
    if idx not in keep_indices:
        rId = prs.slides._sldIdLst[idx].rId
        prs.part.drop_rel(rId)
        del prs.slides._sldIdLst[idx]

print(f"Total slides after trimming: {len(prs.slides)}")
prs.save(dst_path)
print(f"Финальная презентация успешно сохранена: {dst_path}")
