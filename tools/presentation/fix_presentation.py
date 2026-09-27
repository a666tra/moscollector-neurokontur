import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

# Brand palette
COLOR_PRIMARY_PINK = RGBColor(0xFF, 0x00, 0x53)   # #FF0053 Vibrant pink accent
COLOR_DEEP_PURPLE  = RGBColor(0x31, 0x0F, 0x53)   # #310F53 Deep plum brand color
COLOR_MID_PURPLE   = RGBColor(0x52, 0x09, 0x78)   # #520978 Mid purple
COLOR_LIGHT_PINK   = RGBColor(0xFF, 0xD6, 0xE4)   # #FFD6E4 Soft pink highlight
COLOR_WHITE        = RGBColor(0xFF, 0xFF, 0xFF)   # #FFFFFF Clean white
COLOR_DARK_TEXT    = RGBColor(0x1F, 0x29, 0x37)   # #1F2937 High-contrast dark charcoal
COLOR_MUTED_TEXT   = RGBColor(0x4B, 0x55, 0x63)   # #4B5563 Muted dark gray
COLOR_LIGHT_TEXT   = RGBColor(0xF3, 0xF4, 0xF6)   # #F3F4F6 Light gray on dark background
COLOR_SUCCESS_GREEN= RGBColor(0x10, 0xB9, 0x81)   # #10B981 Emerald green accent

def set_run_style(run, font_size_pt=None, color_rgb=None, bold=None):
    if font_size_pt is not None:
        run.font.size = Pt(font_size_pt)
    if color_rgb is not None:
        run.font.color.rgb = color_rgb
    if bold is not None:
        run.font.bold = bold

def set_paragraph_text_and_style(p, text, font_size_pt=12, color_rgb=COLOR_DARK_TEXT, bold=False, align=PP_ALIGN.LEFT):
    p.text = text
    p.alignment = align
    for r in p.runs:
        set_run_style(r, font_size_pt=font_size_pt, color_rgb=color_rgb, bold=bold)

def fix_all_slides():
    src_path = 'presentation/Москоллектор_НейроКонтур_Защита.pptx.bak'
    dst_path = 'presentation/Москоллектор_НейроКонтур_Защита.pptx'
    prs = Presentation(src_path)
    # ==========================================
    # SLIDE 1: ТИТУЛЬНЫЙ СЛАЙД
    # ==========================================
    s1 = prs.slides[0]
    s2 = prs.slides[1]
    # Repoint Slide 1 background from image3.png (which had template text baked in)
    # to image2.png (clean city skyscrapers background with empty left side)
    s1.part.rels['rId2']._target = s2.part.rels['rId2']._target

    for shape in s1.shapes:
        if shape.name == 'TextBox 3':
            shape.left = Inches(0.85)
            shape.top = Inches(1.80)
            shape.width = Inches(8.5)
            shape.height = Inches(4.5)
            shape.text_frame.text = ""

            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "МОСКОЛЛЕКТОР.НЕЙРОКОНТУР", font_size_pt=26, color_rgb=COLOR_WHITE, bold=True)
            p1.space_after = Pt(8)

            p2 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p2, "Программно-аппаратный комплекс аналитики телеметрии\nи оптимизации оперативного реагирования ОДС", font_size_pt=14, color_rgb=COLOR_LIGHT_PINK, bold=True)
            p2.space_after = Pt(12)

            p3 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p3, "КЕЙС №8: АО «МОСКОЛЛЕКТОР»  •  КОМАНДА «VECTOR»", font_size_pt=12, color_rgb=COLOR_WHITE, bold=True)
            p3.space_after = Pt(14)

            highlights = [
                "11 485 каналов телеметрии коллекторного хозяйства в аналитическом контуре",
                "Пакетный инференс: 62,86 мс на CPU (в 4 772 раза быстрее нормативного SLA)",
                "Human-in-the-loop: режим советчика диспетчера с формированием заявок и подбором ЗИП",
                "Автономный локальный запуск в Docker Compose (100% готовность без внешних вызовов)"
            ]
            for h in highlights:
                ph = shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(ph, "•  " + h, font_size_pt=10.5, color_rgb=COLOR_LIGHT_TEXT, bold=False)
                ph.space_after = Pt(4)

    # ==========================================
    # SLIDE 2: АКТУАЛЬНОСТЬ И МАСШТАБ ОБЪЕКТА
    # ==========================================
    s2 = prs.slides[1]
    for shape in s2.shapes:
        if shape.name == 'Скругленный прямоугольник 3':
            shape.left = Inches(0.85)
            shape.top = Inches(0.40)
            shape.width = Inches(5.6)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 1':
            shape.left = Inches(0.95)
            shape.top = Inches(0.45)
            shape.width = Inches(5.4)
            shape.height = Inches(0.55)
            shape.text_frame.margin_left = Inches(0.1)
            shape.text_frame.margin_top = Inches(0.05)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "АКТУАЛЬНОСТЬ И МАСШТАБ ОБЪЕКТА", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name in ['Текст 2', 'TextBox 5']:
            shape.left = Inches(-20)

    # High-contrast branded container card for Slide 2
    s2_card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.85), Inches(1.50), Inches(10.8), Inches(5.10))
    s2_card.fill.solid()
    s2_card.fill.fore_color.rgb = RGBColor(0x1A, 0x0F, 0x2A)  # Deep brand container
    s2_card.line.color.rgb = COLOR_MID_PURPLE
    s2_card.line.width = Pt(1.5)
    s2_card.name = "Slide2_ContentCard"

    tf2 = s2_card.text_frame
    tf2.margin_left = Inches(0.35)
    tf2.margin_right = Inches(0.35)
    tf2.margin_top = Inches(0.30)
    tf2.margin_bottom = Inches(0.25)
    tf2.text = ""

    p1 = tf2.paragraphs[0]
    set_paragraph_text_and_style(p1, "Контекст задачи: инженерная инфраструктура коллекторной сети Москвы", font_size_pt=14, color_rgb=COLOR_PRIMARY_PINK, bold=True)
    p1.space_after = Pt(8)

    p2 = tf2.add_paragraph()
    set_paragraph_text_and_style(p2, "Техническое задание описывает протяженность сети более 825 км и десятки тысяч датчиков СМВУ. Данный масштаб обуславливает высокую нагрузку на дежурные смены ОДС при ручном разборе сигналов телеметрии.", font_size_pt=12, color_rgb=COLOR_WHITE, bold=False)
    p2.space_after = Pt(14)

    bullets = [
        ("ML-выборка кейса:", " 11 485 каналов телеметрии; 174 целевых события в окне 24–72 ч размечены алгоритмически по proxy-отклонениям параметров телеметрии без data leakage."),
        ("Отраслевые ограничения:", " Внешние акты CMMS/1С:ТОИР отсутствуют; реальная доля ложных тревог, подтверждённые аварии и фактическая экономия не измерялись."),
        ("Статус прототипа:", " Демонстрирует ML-ранжирование, фильтрацию дребезга контактов и генерацию нарядов ТОиР; прямого подключения к рабочей SCADA/СМВУ заказчика нет.")
    ]
    for b_title, b_body in bullets:
        pb = tf2.add_paragraph()
        r1 = pb.add_run()
        r1.text = "•  " + b_title
        set_run_style(r1, font_size_pt=11.5, color_rgb=COLOR_LIGHT_PINK, bold=True)
        r2 = pb.add_run()
        r2.text = b_body
        set_run_style(r2, font_size_pt=11.5, color_rgb=COLOR_LIGHT_TEXT, bold=False)
        pb.space_after = Pt(10)

    # ==========================================
    # SLIDE 3: ЦЕЛИ И КЛЮЧЕВЫЕ ЗАДАЧИ ПРОЕКТА
    # ==========================================
    s3 = prs.slides[2]
    for shape in s3.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            shape.left = Inches(0.85)
            shape.top = Inches(0.40)
            shape.width = Inches(5.6)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 1':
            shape.left = Inches(0.95)
            shape.top = Inches(0.45)
            shape.width = Inches(5.4)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ЦЕЛИ И КЛЮЧЕВЫЕ ЗАДАЧИ ПРОЕКТА", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Прямоугольник 28':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "03. Автоматизация нарядов ТОиР", font_size_pt=13, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name in ['Текст 19', 'Текст 23', 'Текст 30']:
            for p in shape.text_frame.paragraphs:
                for r in p.runs:
                    set_run_style(r, font_size_pt=14, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name in ['Текст 2', 'Текст 6', 'Текст 10']:
            for p in shape.text_frame.paragraphs:
                for r in p.runs:
                    set_run_style(r, font_size_pt=12.5, color_rgb=COLOR_LIGHT_TEXT, bold=False)

    # ==========================================
    # SLIDE 4: ФУНКЦИОНАЛЬНЫЕ МОДУЛИ КОМПЛЕКСА
    # ==========================================
    s4 = prs.slides[3]
    for shape in s4.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            shape.left = Inches(0.85)
            shape.top = Inches(0.40)
            shape.width = Inches(5.8)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 1':
            txt = shape.text_frame.text.strip()
            if txt == "ФУНКЦИОНАЛЬНЫЕ МОДУЛИ КОМПЛЕКСА":
                shape.left = Inches(0.95)
                shape.top = Inches(0.45)
                shape.width = Inches(5.6)
                shape.height = Inches(0.55)
                p = shape.text_frame.paragraphs[0]
                set_paragraph_text_and_style(p, "ФУНКЦИОНАЛЬНЫЕ МОДУЛИ КОМПЛЕКСА", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
            elif txt in ["01", "02", "03", "04", "05", "06"]:
                p = shape.text_frame.paragraphs[0]
                set_paragraph_text_and_style(p, txt, font_size_pt=24, color_rgb=COLOR_PRIMARY_PINK, bold=True)
        elif shape.name.startswith('Текст ') and shape.has_text_frame:
            txt = shape.text_frame.text.strip()
            if txt and not txt.isdigit():
                for p in shape.text_frame.paragraphs:
                    for r in p.runs:
                        set_run_style(r, font_size_pt=12, color_rgb=COLOR_DARK_TEXT, bold=False)

    # ==========================================
    # SLIDE 5: ОГРАНИЧЕНИЯ И ТЕХНОЛОГИЧЕСКИЙ СТЕК
    # ==========================================
    s5 = prs.slides[4]
    junk_names = ['TextBox 25', 'TextBox 26', 'Рисунок 19', 'Прямая соединительная линия 29']
    for shape in list(s5.shapes):
        if shape.name in junk_names or shape.name.startswith('Скругленный прямоугольник 2') or shape.name.startswith('Скругленный прямоугольник 3') or shape.name == 'Скругленный прямоугольник 8':
            if shape.has_text_frame:
                shape.text_frame.text = ""
            shape.left = Inches(-20)
            shape.width = Inches(0.01)
            shape.height = Inches(0.01)

    for shape in s5.shapes:
        if shape.name == 'Скругленный прямоугольник 6':
            shape.left = Inches(0.85)
            shape.top = Inches(0.40)
            shape.width = Inches(6.0)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 1':
            shape.left = Inches(0.95)
            shape.top = Inches(0.45)
            shape.width = Inches(5.8)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ОГРАНИЧЕНИЯ И ТЕХНОЛОГИЧЕСКИЙ СТЕК", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Прямоугольник 2':
            shape.left = Inches(0.85)
            shape.top = Inches(1.40)
            shape.width = Inches(5.6)
            shape.height = Inches(0.45)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Архитектурные ограничения и безопасность", font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'TextBox 5':
            shape.left = Inches(0.85)
            shape.top = Inches(1.95)
            shape.width = Inches(5.6)
            shape.height = Inches(5.0)
            shape.text_frame.text = ""
            bullets = [
                "Нет подключения к SCADA/СМВУ, CMMS или рабочей GIS заказчика.",
                "Карта и сценарии локального демо синтетические; реальные координаты и теги не загружены.",
                "Demo-ИД/PIN требуют локальной настройки; это не корпоративная 2FA/LDAP.",
                "Соответствие 149-ФЗ, 152-ФЗ, КИИ и отраслевым регламентам безопасности не оценивалось (требует согласования пилота)."
            ]
            for idx, b in enumerate(bullets):
                p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, "• " + b, font_size_pt=12.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(10)
        elif shape.name == 'Прямоугольник 4':
            shape.left = Inches(6.85)
            shape.top = Inches(1.40)
            shape.width = Inches(5.6)
            shape.height = Inches(0.45)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Технологический стек решения", font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'TextBox 32':
            shape.left = Inches(6.85)
            shape.top = Inches(1.95)
            shape.width = Inches(5.6)
            shape.height = Inches(5.0)
            shape.text_frame.text = ""
            bullets = [
                "Backend & ML: Python 3.10, FastAPI, LightGBM, Scikit-learn, Pydantic v2.",
                "Frontend: React 18, TypeScript, Tailwind CSS, Leaflet GIS.",
                "Хранилище: локальные файлы данных и JSON-журналы инцидентов с криптографическим хэшированием.",
                "Развёртывание: Docker Compose, FastAPI, Uvicorn; локальный запуск через run_local.bat.",
                "Тестирование: 52 автоматизированных теста (100% passed, 0 skipped)."
            ]
            for idx, b in enumerate(bullets):
                p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, "• " + b, font_size_pt=12.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(10)

    # ==========================================
    # SLIDE 6: КОНТЕКСТ КЕЙСА И ЦЕЛЕВЫЕ РОЛИ
    # ==========================================
    s6 = prs.slides[5]
    for shape in s6.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            shape.left = Inches(0.85)
            shape.top = Inches(0.40)
            shape.width = Inches(5.6)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 1':
            shape.left = Inches(0.95)
            shape.top = Inches(0.45)
            shape.width = Inches(5.4)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "КОНТЕКСТ КЕЙСА И ЦЕЛЕВЫЕ РОЛИ", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'TextBox 6':
            shape.left = Inches(7.2)
            shape.top = Inches(0.40)
            shape.width = Inches(5.5)
            shape.height = Inches(0.8)
            for p in shape.text_frame.paragraphs:
                for r in p.runs:
                    set_run_style(r, font_size_pt=10.5, color_rgb=COLOR_LIGHT_TEXT)

    # ==========================================
    # SLIDE 7: Section Separator
    # ==========================================
    s7 = prs.slides[6]
    for shape in s7.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            shape.left = Inches(-20)
        elif shape.name == 'Заголовок 2':
            shape.left = Inches(0.85)
            shape.top = Inches(3.6)
            shape.width = Inches(11.5)
            shape.height = Inches(1.3)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "МОСКОЛЛЕКТОР.НЕЙРОКОНТУР", font_size_pt=36, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 4':
            shape.left = Inches(0.85)
            shape.top = Inches(5.0)
            shape.width = Inches(11.0)
            shape.height = Inches(1.0)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Локальный прототип анализа телеметрических признаков и демонстрации диспетчерского workflow", font_size_pt=16, color_rgb=COLOR_LIGHT_TEXT, bold=False)

    # ==========================================
    # SLIDE 8: О ПРОЕКТЕ И КОМАНДЕ
    # ==========================================
    s8 = prs.slides[7]
    for shape in s8.shapes:
        if shape.name == 'Заголовок 6':
            shape.left = Inches(7.46)
            shape.top = Inches(0.90)  # Placed cleanly below sponsor logos
            shape.width = Inches(5.4)
            shape.height = Inches(0.50)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "О ПРОЕКТЕ И КОМАНДЕ", font_size_pt=18, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 8':
            txt = shape.text_frame.text.strip()
            if "О команде" in txt:
                shape.left = Inches(0.37)
                shape.top = Inches(3.45)
                shape.width = Inches(6.2)
                shape.height = Inches(0.45)
                p = shape.text_frame.paragraphs[0]
                set_paragraph_text_and_style(p, "О команде Vector", font_size_pt=16, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            elif "Команда проекта" in txt:
                shape.left = Inches(0.37)
                shape.top = Inches(4.00)
                shape.width = Inches(6.2)
                shape.height = Inches(2.90)
                shape.text_frame.text = ""
                team_bullets = [
                    "Команда Vector: междисциплинарная группа инженеров (ML, HighLoad API, Web-ГИС, ИБ КИИ).",
                    "Специализация: предиктивный анализ телеметрии и эргономичные интерфейсы для ОДС.",
                    "Принцип разработки: строгая валидация без data leakage и акцент на готовность к пилоту.",
                    "Состав команды: 4 профильных эксперта (ML Lead, Backend Lead, Frontend Lead, DevOps/КИИ)."
                ]
                for idx, b in enumerate(team_bullets):
                    p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p, "• " + b, font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p.space_after = Pt(6)
            elif "Краткое описание" in txt:
                shape.left = Inches(7.46)
                shape.top = Inches(1.50)
                shape.width = Inches(5.4)
                shape.height = Inches(0.35)
                p = shape.text_frame.paragraphs[0]
                set_paragraph_text_and_style(p, "Краткое описание решения:", font_size_pt=13.5, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            elif "Локальный прототип показывает" in txt:
                shape.left = Inches(7.46)
                shape.top = Inches(1.95)
                shape.width = Inches(5.4)
                shape.height = Inches(1.40)
                for p in shape.text_frame.paragraphs:
                    for r in p.runs:
                        set_run_style(r, font_size_pt=11, color_rgb=COLOR_DARK_TEXT)
            elif "Уникальность" in txt:
                shape.left = Inches(7.46)
                shape.top = Inches(3.55)
                shape.width = Inches(5.4)
                shape.height = Inches(0.35)
                p = shape.text_frame.paragraphs[0]
                set_paragraph_text_and_style(p, "Ключевые подтверждённые результаты:", font_size_pt=13.5, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            elif "11 485" in txt:
                shape.left = Inches(7.46)
                shape.top = Inches(4.00)
                shape.width = Inches(5.4)
                shape.height = Inches(3.00)
                shape.text_frame.text = ""
                results_bullets = [
                    "11 485 каналов телеметрии коллекторного хозяйства в аналитическом контуре.",
                    "174 алгоритмические proxy-метки на held-out тесте (без data leakage).",
                    "LightGBM: PR-AUC 0,1679; ROC-AUC 0,7710 (порог tau 0,42: P 8,23%, R 31,61%).",
                    "Пакетный бенчмарк инференса: 62,86 мс на весь парк (P95: 70,65 мс).",
                    "Надежность: 52/52 тестов пройдены успешно (36 API + 5 калибровки + 11 интеграционных)."
                ]
                for idx, b in enumerate(results_bullets):
                    p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p, "• " + b, font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p.space_after = Pt(4)
        elif shape.name == 'Прямая соединительная линия 6':
            shape.left = Inches(7.46)
            shape.top = Inches(1.85)
            shape.width = Inches(5.4)
        elif shape.name == 'Прямая соединительная линия 15':
            shape.left = Inches(7.46)
            shape.top = Inches(3.90)
            shape.width = Inches(5.4)
        elif shape.name == 'Прямая соединительная линия 16':
            shape.left = Inches(0.37)
            shape.top = Inches(3.90)
            shape.width = Inches(6.2)

    # ==========================================
    # SLIDE 9: КОМАНДА ПРОЕКТА (4-CARD EXECUTIVE PROFILES)
    # ==========================================
    s9 = prs.slides[8]
    for shape in s9.shapes:
        if shape.name in ['Скругленный прямоугольник 64', 'Рисунок 5']:
            shape.left = Inches(-20)

    card_xs = [Inches(0.85), Inches(3.85), Inches(6.85), Inches(9.85)]
    card_w = Inches(2.70)
    card_h = Inches(5.30)
    card_top = Inches(1.66)

    card_shapes = ['Скругленный прямоугольник 16', 'Скругленный прямоугольник 55', 'Скругленный прямоугольник 58', 'Скругленный прямоугольник 61']
    for idx, name in enumerate(card_shapes):
        for shape in s9.shapes:
            if shape.name == name:
                shape.left = card_xs[idx]
                shape.top = card_top
                shape.width = card_w
                shape.height = card_h

    # Add stylized avatar badges with initials in each card
    initials_data = ["ML", "BE", "FE", "DO"]
    for idx, init in enumerate(initials_data):
        badge = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, card_xs[idx] + Inches(0.75), Inches(2.00), Inches(1.20), Inches(1.20))
        badge.fill.solid()
        badge.fill.fore_color.rgb = COLOR_DEEP_PURPLE
        badge.line.fill.background()
        badge.name = f"AvatarBadge_{init}"
        p = badge.text_frame.paragraphs[0]
        set_paragraph_text_and_style(p, init, font_size_pt=20, color_rgb=COLOR_LIGHT_PINK, bold=True, align=PP_ALIGN.CENTER)

    team_data = [
        {
            "img": "Рисунок 1",
            "title": "Team Lead / ML",
            "role": "ML & Data Science Lead",
            "contact": "Стек: CatBoost, LightGBM, Scikit-learn",
            "bio": "Архитектура ансамбля моделей, валидация по proxy-меткам без data leakage, Beta-калибровка (Brier 0,0138), PR-AUC Lift 11,1×."
        },
        {
            "img": "Рисунок 2",
            "title": "Backend Lead",
            "role": "Backend & Интеграции",
            "contact": "Стек: Python 3.10+, FastAPI, Pydantic v2",
            "bio": "Асинхронный HighLoad API, потоковая симуляция 11 485 каналов, изолированный аудит-лог с SHA-256, 52/52 пройденных теста."
        },
        {
            "img": "Рисунок 3",
            "title": "Frontend Lead",
            "role": "Frontend & Web-ГИС",
            "contact": "Стек: React 18, TypeScript, Tailwind, Leaflet",
            "bio": "Диспетчерский интерфейс ОДС, интерактивная ГИС-карта, карточки заявок и ЗИП, эргономика Human-in-the-loop."
        },
        {
            "img": "Рисунок 4",
            "title": "DevOps / КИИ",
            "role": "Инфраструктура и ИБ",
            "contact": "Стек: Docker Compose, Linux, 187-ФЗ, 152-ФЗ",
            "bio": "Аудит контура КИИ, изоляция сервисов, контейнеризация Docker Compose, автономия без внешних вызовов, экспорт дистрибутива."
        }
    ]

    for shape in s9.shapes:
        if shape.name == 'Скругленный прямоугольник 12':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(4.5)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 6':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(4.3)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "КОМАНДА ПРОЕКТА", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)

    for shape in s9.shapes:
        if shape.name == 'Текст 8' and shape.has_text_frame:
            orig_left = shape.left.inches
            if orig_left > 10.0:
                shape.left = Inches(-20)
            elif orig_left < 1.5: # Card 1
                shape.left = card_xs[0] + Inches(0.15)
                shape.width = card_w - Inches(0.30)
                if shape.top.inches < 4.3:
                    shape.top = Inches(3.40)
                    shape.height = Inches(0.50)
                    p = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p, team_data[0]["title"], font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True, align=PP_ALIGN.CENTER)
                else:
                    shape.top = Inches(4.00)
                    shape.height = Inches(2.70)
                    shape.text_frame.text = ""
                    p1 = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p1, team_data[0]["role"], font_size_pt=11, color_rgb=COLOR_DEEP_PURPLE, bold=True)
                    p2 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p2, team_data[0]["contact"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p2.space_before = Pt(3)
                    p3 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p3, team_data[0]["bio"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p3.space_before = Pt(3)
            elif orig_left < 4.0: # Card 2
                shape.left = card_xs[1] + Inches(0.15)
                shape.width = card_w - Inches(0.30)
                if shape.top.inches < 4.3:
                    shape.top = Inches(3.40)
                    shape.height = Inches(0.50)
                    p = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p, team_data[1]["title"], font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True, align=PP_ALIGN.CENTER)
                else:
                    shape.top = Inches(4.00)
                    shape.height = Inches(2.70)
                    shape.text_frame.text = ""
                    p1 = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p1, team_data[1]["role"], font_size_pt=11, color_rgb=COLOR_DEEP_PURPLE, bold=True)
                    p2 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p2, team_data[1]["contact"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p2.space_before = Pt(3)
                    p3 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p3, team_data[1]["bio"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p3.space_before = Pt(3)
            elif orig_left < 6.5: # Card 3
                shape.left = card_xs[2] + Inches(0.15)
                shape.width = card_w - Inches(0.30)
                if shape.top.inches < 4.3:
                    shape.top = Inches(3.40)
                    shape.height = Inches(0.50)
                    p = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p, team_data[2]["title"], font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True, align=PP_ALIGN.CENTER)
                else:
                    shape.top = Inches(4.00)
                    shape.height = Inches(2.70)
                    shape.text_frame.text = ""
                    p1 = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p1, team_data[2]["role"], font_size_pt=11, color_rgb=COLOR_DEEP_PURPLE, bold=True)
                    p2 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p2, team_data[2]["contact"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p2.space_before = Pt(3)
                    p3 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p3, team_data[2]["bio"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p3.space_before = Pt(3)
            elif orig_left < 9.0: # Card 4
                shape.left = card_xs[3] + Inches(0.15)
                shape.width = card_w - Inches(0.30)
                if shape.top.inches < 4.3:
                    shape.top = Inches(3.40)
                    shape.height = Inches(0.50)
                    p = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p, team_data[3]["title"], font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True, align=PP_ALIGN.CENTER)
                else:
                    shape.top = Inches(4.00)
                    shape.height = Inches(2.70)
                    shape.text_frame.text = ""
                    p1 = shape.text_frame.paragraphs[0]
                    set_paragraph_text_and_style(p1, team_data[3]["role"], font_size_pt=11, color_rgb=COLOR_DEEP_PURPLE, bold=True)
                    p2 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p2, team_data[3]["contact"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p2.space_before = Pt(3)
                    p3 = shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p3, team_data[3]["bio"], font_size_pt=10, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p3.space_before = Pt(3)

    # ==========================================
    # SLIDE 10: ОПЫТ И ВЫЗОВЫ КОМАНДЫ
    # ==========================================
    s10 = prs.slides[9]
    for shape in s10.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(5.2)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 6':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(5.0)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ОПЫТ И ВЫЗОВЫ КОМАНДЫ", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 8' and shape.has_text_frame:
            txt = shape.text_frame.text.strip()
            if "Краткая история" in txt or "Почему вы выбрали" in txt or "С какими основными" in txt:
                for p in shape.text_frame.paragraphs:
                    for r in p.runs:
                        set_run_style(r, font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            elif txt in ["01", "02", "03"]:
                for p in shape.text_frame.paragraphs:
                    for r in p.runs:
                        set_run_style(r, font_size_pt=22, color_rgb=COLOR_PRIMARY_PINK, bold=True)
            else:
                for p in shape.text_frame.paragraphs:
                    for r in p.runs:
                        set_run_style(r, font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)

    # ==========================================
    # SLIDE 11: КОРОТКО О РЕШЕНИИ
    # ==========================================
    s11 = prs.slides[10]
    for shape in s11.shapes:
        if shape.name == 'Скругленный прямоугольник 9':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(4.8)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(4.6)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "КОРОТКО О РЕШЕНИИ", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 14':
            shape.left = Inches(0.65)
            shape.top = Inches(1.55)
            shape.width = Inches(5.4)
            shape.height = Inches(0.45)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Техническая суть решения", font_size_pt=15, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 16':
            shape.left = Inches(7.12)
            shape.top = Inches(1.55)
            shape.width = Inches(5.4)
            shape.height = Inches(0.45)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Маркетинговая суть решения", font_size_pt=15, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 2':
            shape.left = Inches(0.65)
            shape.top = Inches(2.15)
            shape.width = Inches(5.4)
            shape.height = Inches(4.3)
            shape.text_frame.text = ""
            tech_bullets = [
                "Временное разделение train/val/test; held-out test строго изолирован.",
                "11 485 каналов телеметрии; 174 алгоритмические proxy-positive метки.",
                "LightGBM (порог 0,845): PR-AUC 0,1679; ROC-AUC 0,7710; P 23,24%; R 18,97%.",
                "При tau 0,42: precision 8,23%; recall 31,61% (метрики прогноза признаков).",
                "Пакетный инференс парка: 62,86 мс (P95 70,65 мс) — ускорение к SLA 4 772×.",
                "Инженерный контур: 52/52 тестов (36 API + 5 калибровки + 11 интеграционных) пройдены успешно."
            ]
            for idx, b in enumerate(tech_bullets):
                p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, b, font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(6)
        elif shape.name == 'Текст 6':
            shape.left = Inches(7.12)
            shape.top = Inches(2.15)
            shape.width = Inches(5.4)
            shape.height = Inches(4.3)
            shape.text_frame.text = ""
            mkt_bullets = [
                "Эргономичный диспетчерский пульт ОДС: карточки инцидентов и подбор ЗИП.",
                "Режим советчика диспетчера: человек принимает окончательное решение (Human-in-the-loop).",
                "Сценарный ориентир (не факт экономии; требует пилота): 42,2–56,9 млн ₽/год при 230–310 предотвращённых выездах.",
                "Прозрачность границ: SCADA/CMMS не подключены; окупаемость и ROI требуют пилота.",
                "Готовность к внедрению: документированный REST API контур для инженерных коллекторов."
            ]
            for idx, b in enumerate(mkt_bullets):
                p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, b, font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(6)

    # ==========================================
    # SLIDE 12: ДЕМОНСТРАЦИОННЫЙ WORKFLOW ЗАЯВОК Р ТЭК
    # ==========================================
    s12 = prs.slides[11]
    workflow_content = [
        {
            "header_shape": "Текст 1", "body_shape": "Текст 2",
            "title": "Привязка к пикетам (ПК)",
            "bullets": [
                "Локальный demo-пикетаж: привязка 11 485 каналов к секциям коллектора.",
                "Автоопределение зон ответственности участков эксплуатации.",
                "Для внедрения: сопоставление с паспортами объектов и GIS Москоллектора."
            ]
        },
        {
            "header_shape": "Текст 3", "body_shape": "Текст 4",
            "title": "Маршрутизация бригад",
            "bullets": [
                "Автоформирование нарядов: маршрутизация дежурных бригад по приоритету.",
                "Расчёт ориентировочного времени доезда аварийной службы.",
                "Для внедрения: интеграция с диспетчерскими регламентами и АСУ заказчика."
            ]
        },
        {
            "header_shape": "Текст 5", "body_shape": "Текст 6",
            "title": "Ведомость ЗИП и МТР",
            "bullets": [
                "Автоподбор комплекта ЗИП: датчики, муфты, кабели по типу инцидента.",
                "Сокращение времени подготовки ремонтной бригады к выезду.",
                "Для внедрения: интеграция со складской номенклатурой Москоллектора."
            ]
        },
        {
            "header_shape": "Текст 7", "body_shape": "Текст 8",
            "title": "Контроль исполнения",
            "bullets": [
                "Жизненный цикл заявки: создание, подтверждение инженером ОДС, закрытие.",
                "Фиксация SLA реагирования и ведение неизменяемого аудиторского следа.",
                "Для внедрения: интеграция с КИС Москоллектора и поддержка ЭЦП."
            ]
        }
    ]

    for shape in s12.shapes:
        if shape.name == 'Скругленный прямоугольник 9':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(6.8)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(6.6)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ДЕМОНСТРАЦИОННЫЙ WORKFLOW ЗАЯВОК ТОИР", font_size_pt=14, color_rgb=COLOR_WHITE, bold=True)

    for item in workflow_content:
        for shape in s12.shapes:
            if shape.name == item["header_shape"]:
                p = shape.text_frame.paragraphs[0]
                set_paragraph_text_and_style(p, item["title"], font_size_pt=13, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            elif shape.name == item["body_shape"]:
                shape.text_frame.text = ""
                for idx, b in enumerate(item["bullets"]):
                    p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                    set_paragraph_text_and_style(p, b, font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                    p.space_after = Pt(6)

    # ==========================================
    # SLIDE 13: НАУЧНАЯ ML-ВАЛИДАЦИЯ БЕЗ ЗАГЛЯДЫВАНИЯ В БУДУЩЕЕ
    # ==========================================
    s13 = prs.slides[12]
    pill_shape = None
    for shape in s13.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            pill_shape = shape
            break
    if not pill_shape:
        pill_shape = s13.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.38), Inches(0.35), Inches(6.8), Inches(0.65))
        pill_shape.name = 'Скругленный прямоугольник 1'
    pill_shape.left = Inches(0.38)
    pill_shape.top = Inches(0.35)
    pill_shape.width = Inches(6.8)
    pill_shape.height = Inches(0.65)
    pill_shape.fill.solid()
    pill_shape.fill.fore_color.rgb = COLOR_DEEP_PURPLE
    pill_shape.line.fill.background()

    # Move pill shape behind Title
    s13.shapes._spTree.remove(pill_shape._element)
    s13.shapes._spTree.insert(2, pill_shape._element)

    for shape in s13.shapes:
        if shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(6.6)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "НАУЧНАЯ ML-ВАЛИДАЦИЯ БЕЗ ЗАГЛЯДЫВАНИЯ В БУДУЩЕЕ", font_size_pt=13, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name in ['Текст 1', 'Текст 3', 'Текст 5']:
            for p in shape.text_frame.paragraphs:
                for r in p.runs:
                    set_run_style(r, font_size_pt=13, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name in ['Текст 2', 'Текст 4', 'Текст 6']:
            for p in shape.text_frame.paragraphs:
                for r in p.runs:
                    set_run_style(r, font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)

    # ==========================================
    # SLIDE 14: СЦЕНАРНАЯ ЭКОНОМИЧЕСКАЯ ОЦЕНКА
    # ==========================================
    s14 = prs.slides[13]
    for shape in s14.shapes:
        if shape.name == 'Скругленный прямоугольник 22':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(7.0)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(6.8)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "СЦЕНАРНОЕ МОДЕЛИРОВАНИЕ (НЕ ЯВЛЯЕТСЯ ФАКТОМ ЭКОНОМИИ)", font_size_pt=12.5, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 1':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Сценарная логика расчёта", font_size_pt=16, color_rgb=COLOR_PRIMARY_PINK, bold=True)
        elif shape.name == 'Текст 2':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Нормативно-сценарная модель для демонстрации окупаемости; фактический эффект требует данных 1С:ТОИР и исходов выездов ОДС.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 3':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "15 300 ₽", font_size_pt=24, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 4':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Разница сценарных затрат: аварийный выезд бригады (18 500 ₽) vs плановое ТО (3 200 ₽).", font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 5':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "42,2–56,9 млн ₽/год*", font_size_pt=24, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 6':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Сценарный ориентир при 230–310 предотвращённых инцидентах в месяц (требует подтверждения данными 1С:ТОИР).", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 7':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ROI и окупаемость не заявляются", font_size_pt=16, color_rgb=COLOR_PRIMARY_PINK, bold=True)
        elif shape.name == 'Текст 8':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Стоимость внедрения, серверная инфраструктура и окупаемость рассчитываются строго в рамках ОПЭ.", font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 9':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Предпроектное обследование", font_size_pt=16, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 10':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Оценка CAPEX на серверное оборудование, диод данных и интеграцию с АСУ СМВУ АО «Москоллектор».", font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 11':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Пилотная верификация", font_size_pt=16, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 12':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Фиксация базовой линии (baseline) ложных вызовов за 6 месяцев ОПЭ для объективного расчёта эффекта.", font_size_pt=11.5, color_rgb=COLOR_DARK_TEXT, bold=False)

    # ==========================================
    # SLIDE 15: ЛОКАЛЬНЫЙ BENCHMARK ИНФЕРЕНСА
    # ==========================================
    s15 = prs.slides[14]
    for shape in s15.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(6.0)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(5.8)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ЛОКАЛЬНЫЙ BENCHMARK ИНФЕРЕНСА", font_size_pt=15, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 3':
            shape.left = Inches(0.65)
            shape.top = Inches(1.8)
            shape.width = Inches(5.3)
            shape.height = Inches(4.5)
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "62,86 мс", font_size_pt=48, color_rgb=COLOR_PRIMARY_PINK, bold=True, align=PP_ALIGN.CENTER)
            p2 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p2, "Полный пакет: 11 485 каналов\nP95: 70,65 мс | Задержка одного канала: 1,498 мс\nSLA ТЗ: 300 с (ускорение в 4 772× к нормативу)", font_size_pt=12.5, color_rgb=COLOR_DARK_TEXT, bold=False, align=PP_ALIGN.CENTER)
            p2.space_before = Pt(14)
        elif shape.name == 'Текст 4':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "11 485 каналов за 62,86 мс (P95: 70,65 мс)", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            p2 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p2, "Пакетный инференс всей системы; локальный benchmark на CPU", font_size_pt=10.5, color_rgb=COLOR_MUTED_TEXT, bold=False)
        elif shape.name == 'Текст 5':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "1,498 мс на один канал (P95: 2,585 мс)", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            p2 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p2, "Потоковая обработка единичного измерения в реальном времени", font_size_pt=10.5, color_rgb=COLOR_MUTED_TEXT, bold=False)
        elif shape.name == 'Текст 6':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "182 697 каналов в секунду", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            p2 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p2, "Пиковая пропускная способность алгоритмического ядра", font_size_pt=10.5, color_rgb=COLOR_MUTED_TEXT, bold=False)
        elif shape.name == 'Текст 7':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "SLA норматива ТЗ: 300 секунд", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            p2 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p2, "Фактическая задержка в 4 772 раза быстрее нормативного порога", font_size_pt=10.5, color_rgb=COLOR_MUTED_TEXT, bold=False)
        elif shape.name == 'Текст 8':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "52 из 52 тестов пройдены (100%)", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            p2 = shape.text_frame.add_paragraph()
            set_paragraph_text_and_style(p2, "36 API + 5 калибровки + 11 интеграционных тестов в изолированном тестовом контуре", font_size_pt=10.5, color_rgb=COLOR_MUTED_TEXT, bold=False)

    # ==========================================
    # SLIDE 16: ЛОКАЛЬНЫЙ WORKFLOW: РЕШЕНИЕ СПЕЦИАЛИСТА
    # ==========================================
    s16 = prs.slides[15]
    for shape in s16.shapes:
        if shape.name == 'Скругленный прямоугольник 1':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(6.8)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(6.6)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ЛОКАЛЬНЫЙ WORKFLOW: РЕШЕНИЕ СПЕЦИАЛИСТА", font_size_pt=13.5, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 2':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "1. Поступление телеметрии", font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            bullets = [
                "Автоматизированный мониторинг параметров телеметрии (газ, температура, уровни).",
                "Расчёт скользящих средних и трендов в окне наблюдения.",
                "Выделение аномальных паттернов телеметрии.",
                "Статус: локальный demo-набор, СМВУ не подключено."
            ]
            for b in bullets:
                p = shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, "• " + b, font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(4)
        elif shape.name == 'Текст 3':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "2. Анализ и скоринг риска", font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            bullets = [
                "Расчёт вероятности инцидента моделью LightGBM.",
                "Определение ключевых факторов риска (SHAP-атрибуция).",
                "Селективная фильтрация кандидатов на шум.",
                "Статус: кандидат на шум требует верификации инженером."
            ]
            for b in bullets:
                p = shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, "• " + b, font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(4)
        elif shape.name == 'Текст 4':
            shape.text_frame.text = ""
            p1 = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p1, "3. Решение специалиста ОДС", font_size_pt=14, color_rgb=COLOR_DEEP_PURPLE, bold=True)
            bullets = [
                "Отображение карточки инцидента с топологией и факторами.",
                "Решение диспетчера: подтвердить тревогу или назначить ТО.",
                "Формирование наряда и автоматический подбор ЗИП.",
                "Человек всегда принимает окончательное решение (Human-in-the-loop)."
            ]
            for b in bullets:
                p = shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, "• " + b, font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(4)

    # ==========================================
    # SLIDE 17: ВОЗМОЖНЫЕ ЭТАПЫ ПОСЛЕ СОГЛАСОВАНИЯ
    # ==========================================
    s17 = prs.slides[16]
    for shape in s17.shapes:
        if shape.name == 'Скругленный прямоугольник 11':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(6.8)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(6.6)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "ВОЗМОЖНЫЕ ЭТАПЫ ПОСЛЕ СОГЛАСОВАНИЯ", font_size_pt=14, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 1':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "1. Согласование данных", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 2':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Доступ к деперсонализированной телеметрии и журналам ТОиР/CMMS; аудит ИБ по 149-ФЗ и КИИ.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 7':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "2. Исторический оффлайн-пилот", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 8':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Валидация моделей на ретроспективных данных с верификацией по актам ремонтов и реальных выездов.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 3':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "3. Сверка с журналами ОДС", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 4':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Совместная калибровка порогов селективности со специалистами АО «Москоллектор»; отсечение ложных тревог.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 9':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "4. Опытно-промышленный пилот", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 10':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Работа прототипа в режиме советчика диспетчера в реальном времени без прямого управления оборудованием.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 5':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "5. Промышленная интеграция", font_size_pt=12, color_rgb=COLOR_DEEP_PURPLE, bold=True)
        elif shape.name == 'Текст 6':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Интеграция с корпоративной ГИС, CMMS и СМВУ; ввод в штатную эксплуатацию диспетчерского контура.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)

    # ==========================================
    # SLIDE 18: СТАТУС ПРОТОТИПА И ССЫЛКИ ДЛЯ ПОДАЧИ
    # ==========================================
    s18 = prs.slides[17]
    for shape in s18.shapes:
        if shape.name == 'Скругленный прямоугольник 2':
            shape.left = Inches(0.38)
            shape.top = Inches(0.35)
            shape.width = Inches(6.8)
            shape.height = Inches(0.65)
        elif shape.name == 'Заголовок 13':
            shape.left = Inches(0.50)
            shape.top = Inches(0.40)
            shape.width = Inches(6.6)
            shape.height = Inches(0.55)
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "СТАТУС ПРОТОТИПА И ССЫЛКИ ДЛЯ ПОДАЧИ", font_size_pt=14, color_rgb=COLOR_WHITE, bold=True)
        elif shape.name == 'Текст 3':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Интеграции", font_size_pt=14, color_rgb=COLOR_PRIMARY_PINK, bold=True)
        elif shape.name == 'Текст 4':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Нет подключения к рабочим SCADA/СМВУ, CMMS или системам управления оборудованием. Все контракты реализованы через открытый REST API.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 7':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Безопасность и КИИ", font_size_pt=14, color_rgb=COLOR_PRIMARY_PINK, bold=True)
        elif shape.name == 'Текст 8':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Соответствие 149-ФЗ, 152-ФЗ и регламентам КИИ требует официального согласования в рамках пилота. Локальные demo-учётки изолированы.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 5':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Карта и топология", font_size_pt=14, color_rgb=COLOR_PRIMARY_PINK, bold=True)
        elif shape.name == 'Текст 6':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Топология сети и геопривязка к пикетам смоделированы синтетически для исключения раскрытия чувствительных данных инфраструктуры.", font_size_pt=10.5, color_rgb=COLOR_DARK_TEXT, bold=False)
        elif shape.name == 'Текст 9':
            p = shape.text_frame.paragraphs[0]
            set_paragraph_text_and_style(p, "Комплект сдачи решения (§19 ТЗ)", font_size_pt=13, color_rgb=COLOR_PRIMARY_PINK, bold=True)
        elif shape.name == 'Текст 10':
            shape.text_frame.text = ""
            links = [
                "1. Код решения: Git-репозиторий + релизный ZIP + scripts/reproduce_metrics.py",
                "2. Презентация: PDF-файл 18 слайдов в брендбуке (без сдвигов) + исходный PPTX",
                "3. Прототип: Демонстрационный стенд ОДС (FastAPI + React 18, 52/52 тестов OK)",
                "4. Документация: Пояснительная записка 14 разделов + проект программы ОПЭ",
                "Команда: Vector | Заказчик: АО «Москоллектор» | Кейс №8"
            ]
            for idx, lk in enumerate(links):
                p = shape.text_frame.paragraphs[0] if idx == 0 else shape.text_frame.add_paragraph()
                set_paragraph_text_and_style(p, lk, font_size_pt=9.5, color_rgb=COLOR_DARK_TEXT, bold=False)
                p.space_after = Pt(2)

    phone_card = s18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.62), Inches(1.90), Inches(2.10), Inches(4.00))
    phone_card.fill.solid()
    phone_card.fill.fore_color.rgb = RGBColor(0x18, 0x18, 0x24)
    phone_card.line.fill.background()
    phone_card.name = "PhoneMockScreen"
    tf = phone_card.text_frame
    tf.margin_left = Inches(0.1)
    tf.margin_right = Inches(0.1)
    tf.margin_top = Inches(0.15)
    tf.text = ""
    lines = [
        ("МОСКОЛЛЕКТОР", 10.5, COLOR_WHITE, True),
        ("НейроКонтур v1.0", 9.5, COLOR_PRIMARY_PINK, True),
        ("───────────────", 8, COLOR_MUTED_TEXT, False),
        ("● СИСТЕМА В НОРМЕ", 9, COLOR_SUCCESS_GREEN, True),
        ("Каналов: 11 485", 9, COLOR_WHITE, False),
        ("Инференс: 62.86 мс", 9, COLOR_WHITE, False),
        ("P95 задержка: 70.6 мс", 8.5, COLOR_LIGHT_TEXT, False),
        ("Тесты: 52/52 OK", 9, COLOR_WHITE, False),
        ("Режим: Советчик ОДС", 9, COLOR_LIGHT_PINK, True),
        ("Контур: Изолирован", 8.5, COLOR_MUTED_TEXT, False)
    ]
    for idx, (txt, sz, col, bld) in enumerate(lines):
        p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        set_paragraph_text_and_style(p, txt, font_size_pt=sz, color_rgb=col, bold=bld, align=PP_ALIGN.CENTER)
        p.space_after = Pt(2)

    prs.save(dst_path)
    print("Saved modified presentation to", dst_path)

    dst_path2 = 'Презентация/Москоллектор_НейроКонтур_Презентация.pptx'
    import shutil
    shutil.copy2(dst_path, dst_path2)
    print("Synchronized presentation copy to", dst_path2)

if __name__ == '__main__':
    fix_all_slides()
