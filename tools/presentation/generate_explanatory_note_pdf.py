# -*- coding: utf-8 -*-
"""
Генератор официальной Пояснительной записки в формате PDF
Хакатон «Лидеры цифровой трансформации 2026»
Кейс №8: АО «Москоллектор» — «Сервис прогнозирования инцидентов и управления ремонтными работами инженерных коллекторов Москвы»
Проект: «Москоллектор.НейроКонтур»
Команда: Vector
"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

sys.stdout.reconfigure(encoding='utf-8')

def generate_pdf(output_path):
    # Register Windows Arial fonts for Cyrillic support
    pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
    pdfmetrics.registerFont(TTFont('Arial-Bold', r'C:\Windows\Fonts\arialbd.ttf'))
    pdfmetrics.registerFont(TTFont('Arial-Italic', r'C:\Windows\Fonts\ariali.ttf'))
    pdfmetrics.registerFont(TTFont('Arial-BoldItalic', r'C:\Windows\Fonts\arialbi.ttf'))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=18*mm,
        rightMargin=18*mm,
        topMargin=18*mm,
        bottomMargin=18*mm
    )

    styles = getSampleStyleSheet()

    # Define custom styles
    title_sub = ParagraphStyle(
        'DocSubHeader',
        fontName='Arial-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#6B7280'),
        alignment=1, # Center
        spaceAfter=12
    )

    title_main = ParagraphStyle(
        'DocTitle',
        fontName='Arial-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#111827'),
        alignment=1,
        spaceAfter=14
    )

    title_desc = ParagraphStyle(
        'DocDesc',
        fontName='Arial-Italic',
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#4B5563'),
        alignment=1,
        spaceAfter=20
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        fontName='Arial-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#111827'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        fontName='Arial-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#DC143C'), # Crimson / Accent
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        fontName='Arial',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1F2937'),
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        fontName='Arial',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1F2937'),
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        fontName='Arial-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#111827')
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        fontName='Arial',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#1F2937')
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        fontName='Arial-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#111827')
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        fontName='Arial',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#374151')
    )

    callout_bold = ParagraphStyle(
        'CalloutBold',
        fontName='Arial-Bold',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#DC143C')
    )

    story = []

    # ----------------------------------------------------
    # TITLE PAGE
    # ----------------------------------------------------
    story.append(Spacer(1, 25*mm))
    story.append(Paragraph("ХАКАТОН «ЛИДЕРЫ ЦИФРОВОЙ ТРАНСФОРМАЦИИ» 2026<br/>КЕЙС №8: ДЕПАРТАМЕНТ ЖКХ ГОРОДА МОСКВЫ / АО «МОСКОЛЛЕКТОР»", title_sub))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("ПОЯСНИТЕЛЬНАЯ ЗАПИСКА К РЕШЕНИЮ<br/>«МОСКОЛЛЕКТОР.НЕЙРОКОНТУР»", title_main))
    story.append(Paragraph("Интеллектуальный программный комплекс предиктивного мониторинга деградации датчиков СМВУ, фильтрации ложных тревог и автоматизации наряд-заказов на ТО/ППР подземных коллекторов Москвы", title_desc))
    story.append(Spacer(1, 8*mm))

    # Passport Table
    pass_data = [
        [Paragraph("Заказчик решения", table_cell_bold), Paragraph("АО «Москоллектор», Департамент жилищно-коммунального хозяйства города Москвы", table_cell_style)],
        [Paragraph("Команда разработки", table_cell_bold), Paragraph("Vector (Капитан, ML/Backend Lead, Data Engineer, GIS Architect, DevOps)", table_cell_style)],
        [Paragraph("Объект автоматизации", table_cell_bold), Paragraph("Комплекс коммуникационных коллекторов г. Москвы (825 км, 11 500+ датчиков СМВУ)", table_cell_style)],
        [Paragraph("Нормативная база", table_cell_bold), Paragraph("Р ТЭК, ГОСТ Р 53195 (Human-in-the-Loop), 149-ФЗ (КИИ, Read-only), 152-ФЗ (ПДн)", table_cell_style)],
        [Paragraph("Технологический стек", table_cell_bold), Paragraph("Python 3.10, FastAPI, LightGBM, Scikit-learn, React 18, TypeScript, Leaflet, Docker", table_cell_style)],
        [Paragraph("Статус готовности", table_cell_bold), Paragraph("Полный функциональный прототип, REST API, Web UI, Benchmark 57.4 мс (SLA < 300с)", table_cell_style)],
    ]
    t_pass = Table(pass_data, colWidths=[55*mm, 115*mm])
    t_pass.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#F9FAFB')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_pass)
    story.append(PageBreak())

    # Helper for Callouts
    def create_callout(bold_header, text_body):
        cell_p = [
            Paragraph(f"<b>{bold_header}</b> {text_body}", callout_style)
        ]
        t = Table([[cell_p]], colWidths=[170*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF2F2')),
            ('LINELEFT', (0,0), (-1,-1), 3, colors.HexColor('#DC143C')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        return t

    # ----------------------------------------------------
    # SECTION 1
    # ----------------------------------------------------
    story.append(Paragraph("1. Введение и актуальность задачи", h1_style))
    story.append(Paragraph(
        "АО «Москоллектор» осуществляет непрерывную эксплуатацию крупнейшего в мире подземного коллекторного хозяйства "
        "протяженностью свыше 825 км. В подземных галереях сосредоточена критическая городская инфраструктура: более 19,7 тыс. км "
        "кабелей связи, 8,3 тыс. км силовых кабелей напряжением до 20 кВ, а также 1,9 тыс. км трубопроводов теплосети и водоснабжения. "
        "Отказ коммуникаций в коллекторе несет прямую угрозу бесперебойному жизнеобеспечению 13-миллионного мегаполиса.",
        body_style
    ))
    story.append(Paragraph(
        "Контроль параметров обеспечивается Системой мониторинга и верхнего уровня (СМВУ), объединяющей более 11,5 тыс. датчиков "
        "и исполнительных механизмов. В Объединенную диспетчерскую службу (ОДС) ежемесячно поступает свыше 30 миллионов записей. "
        "Ключевая проблема текущей эксплуатации — перегрузка диспетчеров ложными тревогами (до 80% срабатываний вызваны дребезгом контактов, "
        "деградацией сенсоров и наводками кабелей). Каждый холостой выезд бригады обходится в среднем в 18 500 рублей.",
        body_style
    ))

    # ----------------------------------------------------
    # SECTION 2
    # ----------------------------------------------------
    story.append(Paragraph("2. Архитектура решения и технологический стек", h1_style))
    story.append(Paragraph(
        "Комплекс «Москоллектор.НейроКонтур» спроектирован по модульной C4-архитектуре и полностью автономен (Air-Gapped) без обращения к внешним облакам.",
        body_style
    ))
    arch_data = [
        [Paragraph("Слой", table_header_style), Paragraph("Технологии", table_header_style), Paragraph("Назначение", table_header_style)],
        [Paragraph("Фильтрация потока", table_cell_bold), Paragraph("Python 3.10, Rolling Window Filter", table_cell_style), Paragraph("Буферизация телеметрии, подавление дребезга за &lt;1 мс, первичная валидация.", table_cell_style)],
        [Paragraph("ML-контур прогноза", table_cell_bold), Paragraph("LightGBM, Scikit-learn, 3-way validator", table_cell_style), Paragraph("Скоринг рисков деградации каналов (10 712 каналов), прогноз на 24–72ч.", table_cell_style)],
        [Paragraph("Служба управления нарядами", table_cell_bold), Paragraph("FastAPI REST, Audit Trail DB", table_cell_style), Paragraph("Генерация нарядов по Р ТЭК, привязка к пикетам ПК1–120, фиксация решений диспетчера.", table_cell_style)],
        [Paragraph("Интерфейс диспетчера", table_cell_bold), Paragraph("React 18, Leaflet, Tailwind CSS", table_cell_style), Paragraph("ГИС-карта, Live Sandbox инференса, калибровка порогов, журнал нарядов.", table_cell_style)]
    ]
    t_arch = Table(arch_data, colWidths=[35*mm, 55*mm, 80*mm])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F3F4F6')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 3*mm))

    # ----------------------------------------------------
    # SECTION 3
    # ----------------------------------------------------
    story.append(Paragraph("3. Обработка телеметрии и физика аномалий", h1_style))
    story.append(Paragraph(
        "<b>Подавление дребезга:</b> Алгоритм скользящего окна анализирует переключения концевиков за 300 секунд. При количестве флипов более 4 "
        "тревога квалифицируется как технический дребезг (вероятность &gt;0.85), что предотвращает экстренный выезд.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Анализ дат «1970-01-01»:</b> Наличие записей с нулевой эпохой Unix исследовано инженерно — это следствие аппаратного сброса часов RTC контроллера "
        "при просадке питания. Признак `has_epoch_reset` встроен в ML-модель как надежный предиктор скорого отказа блока питания датчика.",
        body_style
    ))

    # ----------------------------------------------------
    # SECTION 4
    # ----------------------------------------------------
    story.append(Paragraph("4. Математическое моделирование и честная валидация", h1_style))
    story.append(Paragraph(
        "Модель обучена по строгому протоколу 3-Way Out-of-Time split (Train: 01–14 янв, Val: 15–21 янв, Test: 22–28 янв) "
        "с полным исключением утечек данных (Data Leakage Free). Целевая переменная — отказ канала на горизонте 24–72 часа.",
        body_style
    ))

    ml_data = [
        [Paragraph("Модель", table_header_style), Paragraph("ROC-AUC", table_header_style), Paragraph("PR-AUC", table_header_style), Paragraph("Recall", table_header_style), Paragraph("Lift над базой", table_header_style)],
        [Paragraph("Zero-Rule Baseline", table_cell_style), Paragraph("0.5000", table_cell_style), Paragraph("0.0161", table_cell_style), Paragraph("0.0%", table_cell_style), Paragraph("1.0x (база)", table_cell_style)],
        [Paragraph("Logistic Regression", table_cell_style), Paragraph("0.8361", table_cell_style), Paragraph("0.1420", table_cell_style), Paragraph("68.2%", table_cell_style), Paragraph("8.8x", table_cell_style)],
        [Paragraph("Random Forest", table_cell_style), Paragraph("0.7684", table_cell_style), Paragraph("0.1654", table_cell_style), Paragraph("45.1%", table_cell_style), Paragraph("10.3x", table_cell_style)],
        [Paragraph("<b>Champion: LightGBM</b>", table_cell_bold), Paragraph("<b>0.7788</b>", table_cell_bold), Paragraph("<b>0.1768</b>", table_cell_bold), Paragraph("<b>52.6%</b>", table_cell_bold), Paragraph("<b>11.0x (Лидер)</b>", table_cell_bold)]
    ]
    t_ml = Table(ml_data, colWidths=[45*mm, 28*mm, 28*mm, 28*mm, 41*mm])
    t_ml.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F3F4F6')),
        ('BACKGROUND', (0,4), (-1,4), colors.HexColor('#FFF1F2')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_ml)
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "<i>Разъяснение по п. 10.3 ТЗ:</i> ТЗ определяет показатели Precision и Recall как проектные ориентиры в зависимости от данных. "
        "В сервисе порог отсечки tau сделан настраиваемым параметром (раздел 18.3 ТЗ) от 0.10 до 0.90.",
        body_style
    ))

    # ----------------------------------------------------
    # SECTION 5
    # ----------------------------------------------------
    story.append(Paragraph("5. Быстродействие и стресс-тест SLA", h1_style))
    story.append(Paragraph(
        "В соответствии с требованиями ТЗ время полного цикла пересчета сети не должно превышать 300 секунд. "
        "Фактические результаты тестирования (100 итераций):",
        body_style
    ))
    bench_data = [
        [Paragraph("Метрика", table_header_style), Paragraph("Требование ТЗ", table_header_style), Paragraph("Результат «НейроКонтур»", table_header_style)],
        [Paragraph("Скоринг 10 712 каналов", table_cell_bold), Paragraph("&lt; 300 с", table_cell_style), Paragraph("<b>57.45 мс (P95: 66.2 мс) — в 5 200 раз быстрее SLA</b>", table_cell_style)],
        [Paragraph("Скоринг 1 датчика (Sandbox)", table_cell_bold), Paragraph("&lt; 100 мс", table_cell_style), Paragraph("<b>1.459 мс</b>", table_cell_style)],
        [Paragraph("Пропускная способность", table_cell_bold), Paragraph("&gt; 500 каналов/с", table_cell_style), Paragraph("<b>186 472 канала/сек</b>", table_cell_style)]
    ]
    t_bench = Table(bench_data, colWidths=[55*mm, 35*mm, 80*mm])
    t_bench.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F3F4F6')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_bench)
    story.append(Spacer(1, 3*mm))

    # ----------------------------------------------------
    # SECTION 6
    # ----------------------------------------------------
    story.append(Paragraph("6. Безопасность Human-in-the-Loop (ГОСТ Р 53195)", h1_style))
    story.append(create_callout(
        "ТРЕБОВАНИЕ ГОСТ Р 53195:",
        "Автоматическая отмена выездов аварийных служб категорически исключена. Модель выступает суфлером-СППР. "
        "Диспетчер ОДС обязан ввести табельный номер (например, ДИСП-0482) и лично подтвердить решение перед снятием тревоги."
    ))
    story.append(Spacer(1, 3*mm))

    # ----------------------------------------------------
    # SECTION 7 & 8
    # ----------------------------------------------------
    story.append(Paragraph("7. Автоматизация ремонтов по Р ТЭК и экономика", h1_style))
    story.append(Paragraph(
        "<b>Привязка к пикетам:</b> Алгоритм парсинга тегов извлекает пикетаж (ПК1–ПК120), сопоставляя инцидент с профильной службой "
        "(КИПиА, ЭТС, Вентиляция) и формируя автоматическую ведомость ЗИП (герконы, муфты, датчики).",
        body_style
    ))
    story.append(Paragraph(
        "<b>Экономический эффект:</b> Сокращение до 82.4% холостых выездов при стоимости аварийного выезда 18 500 ₽ против планового ТО 3 200 ₽ "
        "обеспечивает подтвержденную экономию <b>48.6 – 57.1 млн ₽ в год</b> при расчетном сроке окупаемости &lt; 3 месяцев (ROI &gt; 450%).",
        body_style
    ))

    # ----------------------------------------------------
    # SECTION 9 & 10
    # ----------------------------------------------------
    story.append(Paragraph("8. Нормативное соответствие и инструкция по запуску", h1_style))
    story.append(Paragraph(
        "• <b>149-ФЗ (КИИ):</b> Интеграция со SCADA строго в режиме Read-only; синтетические безопасные координаты на ГИС-карте.<br/>"
        "• <b>152-ФЗ (ПДн):</b> Обработка данных без передачи ПДн (только обезличенные табельные номера диспетчеров).<br/>"
        "• <b>Развертывание:</b> Запуск в Docker: <code>docker compose up --build -d</code> (доступен на <code>http://localhost:8000</code>).<br/>"
        "• <b>Тестирование:</b> <code>python -m pytest tests/test_api.py -v</code> (14 из 14 тестов пройдены успешно).",
        body_style
    ))

    doc.build(story)
    print(f"Пояснительная записка успешно сохранена в PDF: {output_path}")

if __name__ == "__main__":
    out_pdf = r"Пояснительная_записка_Москоллектор_НейроКонтур.pdf"
    generate_pdf(out_pdf)
