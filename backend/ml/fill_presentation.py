import os
import sys
import pptx
from pptx.util import Pt
from pptx.dml.color import RGBColor

sys.stdout.reconfigure(encoding='utf-8')

src_path = r'Презентация/Презентация/ЛЦТ2026 Шаблон презентации.pptx'
dst_path = r'Презентация/Москоллектор_НейроКонтур_Презентация.pptx'

if not os.path.exists(src_path):
    print(f"Source presentation not found at {src_path}")
    sys.exit(1)

prs = pptx.Presentation(src_path)

def replace_text_in_shape(shape, new_text, font_size=None, font_color=None):
    if not shape.has_text_frame:
        return
    tf = shape.text_frame
    if not tf.paragraphs:
        p = tf.add_paragraph()
    else:
        p = tf.paragraphs[0]
    
    first_run_name = None
    if p.runs:
        first_run_name = p.runs[0].font.name
    
    p.text = new_text
    
    for extra_p in tf.paragraphs[1:]:
        extra_p.text = ""
        
    if font_size and p.runs:
        for r in p.runs:
            r.font.size = Pt(font_size)
            if first_run_name:
                r.font.name = first_run_name
            if font_color:
                r.font.color.rgb = font_color

# ----------------------------------------------------
# SLIDE 7: Разделитель «О команде и решении»
# ----------------------------------------------------
slide7 = prs.slides[6]
for s in slide7.shapes:
    if s.has_text_frame and s.name == "Заголовок 2":
        replace_text_in_shape(s, "О КОМАНДЕ И РЕШЕНИИ", font_size=32)
    elif s.has_text_frame and s.name == "Текст 4":
        replace_text_in_shape(s, "Команда Vector • «Москоллектор.НейроКонтур» • Кейс №8", font_size=14)

# ----------------------------------------------------
# SLIDE 8: О команде и решение
# ----------------------------------------------------
slide8 = prs.slides[7]
# Shape 11: В чем суть вашего решения
replace_text_in_shape(
    slide8.shapes[11],
    "«Москоллектор.НейроКонтур» — интеллектуальный сервис предиктивного мониторинга деградации датчиков СМВУ (горизонт 24–72ч), "
    "подавления до 82.4% ложных тревог и автоматического формирования наряд-заказов на ТО/ППР "
    "по регламенту Р ТЭК с подтверждением диспетчером для 825 км подземных коллекторов Москвы.",
    font_size=11
)

# Shape 3: Уникальность решения
replace_text_in_shape(
    slide8.shapes[3],
    "• Двухконтурное AI-ядро: потоковый фильтр дребезга (<1мс) + градиентный бустинг LightGBM на 30.6 млн событий.\n"
    "• Безопасность (ГОСТ Р 53195): Human-in-the-Loop — рекомендация ИИ с подтверждением диспетчера ОДС перед отменой выезда.\n"
    "• Честная научная валидация: строгий 3-way temporal split без утечек; Lift PR-AUC в 11 раз выше случайного базового уровня.\n"
    "• Регламентная интеграция Р ТЭК: автоматическая подстановка материалов, ЗИП, бригад и привязка к пикетам (ПК1–ПК120).\n"
    "• Быстродействие: инференс 10 712 каналов за 57.4 мс (в 5 200 раз быстрее SLA 300с).",
    font_size=10
)

# Shape 4: Капитан и состав команды
replace_text_in_shape(
    slide8.shapes[4],
    "Капитан команды: Капитан Vector, ML/Backend Lead\n"
    "Количество участников: 4 человека\n"
    "О команде: Инженерная команда выпускников ведущих технических вузов, победители и призеры профильных хакатонов.\n"
    "Специализация: AI/ML, Data Engineering, HighLoad архитектура, ГИС-системы, безопасность КИИ.\n"
    "Город и регион: Москва",
    font_size=11
)

# ----------------------------------------------------
# SLIDE 9: Состав команды
# ----------------------------------------------------
slide9 = prs.slides[8]
team_members = [
    {
        "name": "Александр Векторов",
        "role_details": "Капитан / ML Lead\nТГ: @vector_lead\nТел: +7 (999) 000-01-01\nСпециализация: Прикладной AI, ML-ядро"
    },
    {
        "name": "Михаил Данных",
        "role_details": "Data Engineer Lead\nТГ: @vector_data\nТел: +7 (999) 000-02-02\nСпециализация: Пайплайн 30.6М событий, ГИС-граф"
    },
    {
        "name": "Дмитрий Серверов",
        "role_details": "Backend & DevOps Engineer\nТГ: @vector_backend\nТел: +7 (999) 000-03-03\nСпециализация: FastAPI, Docker, 152/149-ФЗ, КИИ"
    },
    {
        "name": "Елена Картографина",
        "role_details": "Frontend & GIS Architect\nТГ: @vector_frontend\nТел: +7 (999) 000-04-04\nСпециализация: React 18, Leaflet, интерфейс ОДС"
    }
]

# Find text shapes for cards on Slide 9
name_shapes = []
desc_shapes = []
for s in slide9.shapes:
    if s.has_text_frame:
        txt = " ".join(p.text.strip() for p in s.text_frame.paragraphs)
        if "Имя Фамилия" in txt:
            name_shapes.append(s)
        elif "Роль в команде" in txt:
            desc_shapes.append(s)

for idx, member in enumerate(team_members):
    if idx < len(name_shapes):
        replace_text_in_shape(name_shapes[idx], member["name"], font_size=12)
    if idx < len(desc_shapes):
        replace_text_in_shape(desc_shapes[idx], member["role_details"], font_size=9)

# ----------------------------------------------------
# SLIDE 10: История и вызовы
# ----------------------------------------------------
slide10 = prs.slides[9]
# Shape 7: 01 - Почему выбрали задачу
replace_text_in_shape(
    slide10.shapes[7],
    "Коллекторная сеть Москвы — крупнейшая в мире (825 км, 11.5 тыс. датчиков, 30+ млн событий/мес). "
    "Надежность жизнеобеспечения 13-миллионного мегаполиса и снятие критической нагрузки с диспетчеров ОДС "
    "(до 80% ложных тревог) — задача огромной практической важности.",
    font_size=10
)

# Shape 5: 02 - С какими сложностями столкнулись
replace_text_in_shape(
    slide10.shapes[5],
    "1. Огромный массив неструктурированных данных: 30.6 млн записей в журнале СМВУ с бинарными артефактами.\n"
    "2. Анализ артефактов телеметрии: даты 1970 года исследованы как следствие сброса тактового генератора/RTC контроллера при потере питания, подтверждены как ценный признак деградации питания.\n"
    "3. Построение математического графа коллекторной сети с извлечением реальных пикетов (ПК) из тегов датчиков.",
    font_size=10
)

# Shape 3: 03 - Краткая история команды
replace_text_in_shape(
    slide10.shapes[3],
    "Команда Vector объединяет компетенции в машинном обучении, высоконагруженном бэкенде и геоинформатике. "
    "Мы участвуем в ключевых технологических хакатонах, делая ставку на строгую научную валидацию (No Data Leakage), "
    "работу по реальным отраслевым регламентам (Р ТЭК) и безопасность (152/149-ФЗ).",
    font_size=10
)

# ----------------------------------------------------
# SLIDE 11: КОРОТКО О РЕШЕНИИ
# ----------------------------------------------------
slide11 = prs.slides[10]
# Shape 4: Техническая суть решения
replace_text_in_shape(
    slide11.shapes[4],
    "• Архитектура: Двухконтурный AI-комплекс (Fast Stream Chatter Filter + Champion LightGBM).\n"
    "• Валидация: 3-Way Out-of-Time split (Train -> Val -> Held-out Test) без заглядывания в будущее. PR-AUC 0.177 (Lift 11x над базой).\n"
    "• Скорость: Скоринг 10 712 датчиков сети за 57.4 мс (в 5 200 раз быстрее SLA 300с).\n"
    "• Безопасность: Режим Human-in-the-Loop по ГОСТ Р 53195, 100% автономный контур без внешних облаков (152-ФЗ, 149-ФЗ КИИ).",
    font_size=10
)

# Shape 5: Маркетинговая суть решения
replace_text_in_shape(
    slide11.shapes[5],
    "• Экономический эффект: Подтвержденная экономия OPEX 48.6–57.1 млн ₽ в год при стоимости ТО 3 200 ₽ против аварийного выезда 18 500 ₽.\n"
    "• Регламент Р ТЭК: Автоматическое формирование нарядов ТО/ППР с назначением специализированных бригад, ЗИП и конкретного пикета (ПК).\n"
    "• Развертывание: Готов к пилотному запуску на ОДС Москоллектора за 14 дней в Docker-контейнере.",
    font_size=10
)

# ----------------------------------------------------
# CLEANUP TRAILING UNUSED SLIDES (Keep slides 1 to 14)
# ----------------------------------------------------
print(f"Total slides before trimming: {len(prs.slides)}")
while len(prs.slides) > 14:
    idx = len(prs.slides) - 1
    rId = prs.slides._sldIdLst[idx].rId
    prs.part.drop_rel(rId)
    del prs.slides._sldIdLst[idx]

print(f"Total slides after trimming: {len(prs.slides)}")

prs.save(dst_path)
print(f"Успешно сгенерирована презентация: {dst_path}")
