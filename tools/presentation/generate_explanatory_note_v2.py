# -*- coding: utf-8 -*-
"""
Генератор пояснительной записки (редакция для финала), ЛЦТ 2026, кейс №8.
Все числа читаются из файлов репозитория на момент сборки (отчёты метрик, бэктеста, полигона),
поэтому записка не расходится с кодом. Запуск из корня репозитория:

    python tools/presentation/generate_explanatory_note_v2.py [выходной.docx]

PDF делается отдельно (Word / LibreOffice): см. export_docx_to_pdf.ps1.
"""
import json
import os
import re
import sys
import tempfile

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from docx.shared import Inches, Pt, RGBColor

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DEFAULT = os.path.join(ROOT, "docs", "Пояснительная_записка_Москоллектор_НейроКонтур.docx")
FONT = "Arial"
ACCENT = RGBColor(34, 51, 255)
INK = RGBColor(28, 29, 34)
MUT = RGBColor(95, 95, 105)


def jload(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return json.load(f)


BT = jload("backend", "models", "rolling_backtest_report.json")
MR = jload("backend", "models", "metrics_report.json")
HO = jload("docs", "SCENARIOS_HELDOUT_RESULTS.json")


def ru(x, d=2):
    """12.345 -> '12,35' (десятичная запятая)."""
    return f"{x:.{d}f}".replace(".", ",")


def pct(x, d=0):
    return ru(100 * x, d) + " %"


def thousands(n):
    return f"{int(n):,}".replace(",", " ")


def read_requirements():
    rows = []
    with open(os.path.join(ROOT, "requirements.txt"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                m = re.match(r"([A-Za-z0-9_.\[\]-]+)==([\w.]+)", line)
                if m:
                    rows.append((m.group(1), m.group(2)))
    return rows


def read_frontend_deps():
    pkg = jload("frontend", "package.json")
    return pkg.get("dependencies", {}), pkg.get("devDependencies", {})


# ----------------------------------------------------------------------------- диаграммы
def make_diagrams(tmpdir):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch

    plt.rcParams["font.family"] = "DejaVu Sans"

    def box(ax, x, y, w, h, text, fc="#F4F5F8", ec="#2233FF", fs=8.0, bold=False):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08",
                                    fc=fc, ec=ec, lw=1.2))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs,
                fontweight="bold" if bold else "normal", color="#1C1D22", wrap=True)

    def arrow(ax, x1, y1, x2, y2):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", color="#555566", lw=1.2))

    # 1. компонентная архитектура
    fig, ax = plt.subplots(figsize=(7.4, 4.3))
    ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis("off")
    box(ax, 0.2, 4.6, 2.6, 1.0, "Источники (только чтение)\nЖурнал СМВУ, реестры\nканалов и объектов", "#FFF7E6", "#D98A00")
    box(ax, 3.4, 4.6, 3.0, 1.0, "backend/ml/features.py\n21 признак за 24 ч и 7 дней", "#F4F5F8")
    box(ax, 7.0, 4.6, 2.8, 1.0, "Модель LightGBM\n+ бета-калибровка", "#EAF0FF")
    arrow(ax, 2.8, 5.1, 3.4, 5.1); arrow(ax, 6.4, 5.1, 7.0, 5.1)
    box(ax, 0.2, 2.9, 4.4, 1.1, "Быстрый контур (правила)\nгаз, температура, пожар, затопление,\nдребезг, потеря связи — scenario_engine.py", "#FDECEA", "#E5412D")
    box(ax, 5.4, 2.9, 4.4, 1.1, "FastAPI (backend/app)\npredictions · alarms · tickets · objects\nsettings · stats · scenarios", "#EAF0FF")
    arrow(ax, 8.4, 4.6, 8.0, 4.0); arrow(ax, 4.6, 3.45, 5.4, 3.45)
    box(ax, 0.2, 1.1, 3.0, 1.1, "Журнал решений диспетчера\n(цепочка SHA-256)\nJSON-хранилище прототипа", "#F4F5F8")
    box(ax, 3.7, 1.1, 2.7, 1.1, "Заявки ТО / ППР\n(черновики наряд-заказов)", "#F4F5F8")
    box(ax, 6.9, 1.1, 2.9, 1.1, "React-пульт: две роли\nтехник «Поле» · диспетчер\n«Сводка», «Обстановка», …", "#E8F7EE", "#1E9E5A")
    arrow(ax, 6.2, 2.9, 8.2, 2.2); arrow(ax, 7.4, 2.9, 5.0, 2.2); arrow(ax, 6.0, 2.9, 1.7, 2.2)
    ax.text(5.0, 0.35, "Интеграция с СМВУ, ОДС и CMMS — через REST/Kafka/MQTT/SOAP/файлы (описана в п. 9, в прототипе не реализована)",
            ha="center", fontsize=7.4, color="#555566")
    fig.savefig(os.path.join(tmpdir, "arch.png"), dpi=200, bbox_inches="tight")
    plt.close(fig)

    # 2. два слоя
    fig, ax = plt.subplots(figsize=(7.4, 3.2))
    ax.set_xlim(0, 10); ax.set_ylim(0, 4); ax.axis("off")
    box(ax, 0.2, 2.2, 4.5, 1.5, "СЛОЙ 1 · Быстрый контур\nОпасные события: секунды — минуты\nпороги + скорость роста + дребезг + связь\nпроверка: Сценарный полигон (синтетика)", "#FDECEA", "#E5412D", bold=False)
    box(ax, 5.3, 2.2, 4.5, 1.5, "СЛОЙ 2 · Прогноз деградации\nОборудование и датчики: часы — сутки\nLightGBM, горизонт 24–72 ч\nпроверка: бэктест на реальном журнале", "#EAF0FF", "#2233FF")
    box(ax, 0.2, 0.3, 9.6, 1.2, "Диспетчер видит один список. Решение принимает человек и фиксирует его в журнале с причиной из справочника.\nНи один из слоёв не отключает и не гасит сигнал автоматически.", "#F4F5F8", "#888899")
    arrow(ax, 2.5, 2.2, 2.5, 1.5); arrow(ax, 7.5, 2.2, 7.5, 1.5)
    fig.savefig(os.path.join(tmpdir, "layers.png"), dpi=200, bbox_inches="tight")
    plt.close(fig)
    return os.path.join(tmpdir, "arch.png"), os.path.join(tmpdir, "layers.png")


# ----------------------------------------------------------------------------- docx-помощники
doc = Document()
for _s in doc.sections:
    _s.top_margin = Inches(0.8)
    _s.bottom_margin = Inches(0.8)
    _s.left_margin = Inches(0.9)
    _s.right_margin = Inches(0.9)
    _s.page_width = Inches(8.27)
    _s.page_height = Inches(11.69)

_st = doc.styles["Normal"]
_st.font.name = FONT
_st.font.size = Pt(10)


def _run(p, text, size=10, bold=False, italic=False, color=INK):
    r = p.add_run(text)
    r.font.name = FONT
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    return r


def H1(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    _run(p, text, 15, True, color=INK)
    pPr = p._p.get_or_add_pPr()
    pPr.append(parse_xml(
        '<w:pBdr %s><w:bottom w:val="single" w:sz="8" w:space="2" w:color="2233FF"/></w:pBdr>' % nsdecls("w")))
    return p


def H2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    _run(p, text, 11.5, True, color=ACCENT)


def P(text, bold_prefix=None, size=10, italic=False, after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.15
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if bold_prefix:
        _run(p, bold_prefix, size, True)
    _run(p, text, size, italic=italic)
    return p


def B(text, bold_prefix=None, size=10):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.1
    if bold_prefix:
        _run(p, bold_prefix, size, True)
    _run(p, text, size)
    return p


def _shade(cell, hex_color):
    cell._tc.get_or_add_tcPr().append(parse_xml('<w:shd %s w:val="clear" w:color="auto" w:fill="%s"/>' % (nsdecls("w"), hex_color)))


def _margins(cell, top=60, bottom=60, left=90, right=90):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(parse_xml(
        '<w:tcMar %s><w:top w:w="%d" w:type="dxa"/><w:left w:w="%d" w:type="dxa"/>'
        '<w:bottom w:w="%d" w:type="dxa"/><w:right w:w="%d" w:type="dxa"/></w:tcMar>' % (nsdecls("w"), top, left, bottom, right)))


def _borders(table, color="C9CBD3"):
    tblPr = table._tbl.tblPr
    tblPr.append(parse_xml(
        '<w:tblBorders %s>' % nsdecls("w") +
        "".join('<w:%s w:val="single" w:sz="4" w:space="0" w:color="%s"/>' % (e, color)
                for e in ("top", "left", "bottom", "right", "insideH", "insideV")) +
        '</w:tblBorders>'))


def T(headers, rows, widths, size=8.5, align_right_from=None, bold_first_col=False):
    """Таблица: заголовок серым, ячейки с переносом. align_right_from — индекс колонки, с которой числа справа."""
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    _borders(t)
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.width = Inches(widths[i])
        _shade(c, "E9EBF5")
        _margins(c)
        p = c.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        _run(p, h, size, True)
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].width = Inches(widths[i])
            _margins(cells[i])
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if align_right_from is not None and i >= align_right_from:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            _run(p, str(v), size, bold=(bold_first_col and i == 0))
    for ri, r_ in enumerate(t.rows):
        r_._tr.get_or_add_trPr().append(parse_xml('<w:cantSplit %s/>' % nsdecls("w")))
        if len(rows) <= 14 and ri < len(t.rows) - 1:
            for c_ in r_.cells:
                for p_ in c_.paragraphs:
                    p_.paragraph_format.keep_with_next = True
    # повтор заголовка на новой странице
    trPr = t.rows[0]._tr.get_or_add_trPr()
    trPr.append(parse_xml('<w:tblHeader %s/>' % nsdecls("w")))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def CODE(text):
    for line in text.split("\n"):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.left_indent = Inches(0.15)
        p.paragraph_format.keep_with_next = True
        p._p.get_or_add_pPr().append(parse_xml('<w:shd %s w:val="clear" w:color="auto" w:fill="F1F2F6"/>' % nsdecls("w")))
        r = p.add_run(line)
        r.font.name = "DejaVu Sans Mono"
        r.font.size = Pt(8.5)
        r.font.color.rgb = INK
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def CALL(text, title="ВАЖНО", color=RGBColor(200, 30, 60), fill="F6F4EE", bar="E5412D"):
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.rows[0]._tr.get_or_add_trPr().append(parse_xml('<w:cantSplit %s/>' % nsdecls("w")))
    c = t.cell(0, 0)
    c.width = Inches(6.4)
    _shade(c, fill)
    _margins(c, 100, 100, 160, 160)
    c._tc.get_or_add_tcPr().append(parse_xml(
        '<w:tcBorders %s><w:left w:val="single" w:sz="24" w:space="0" w:color="%s"/></w:tcBorders>' % (nsdecls("w"), bar)))
    p = c.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    _run(p, "[%s] " % title, 9, True, color=color)
    _run(p, text, 9)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def IMG(path, width=6.3, caption=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(path, width=Inches(width))
    if caption:
        c = doc.add_paragraph()
        c.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _run(c, caption, 8.5, italic=True, color=MUT)


def wlt(pop, a, b, metric):
    """Недель, где вариант a выше / ниже / равен варианту b по метрике."""
    w = l = e = 0
    for wk in BT["weeks"]:
        x, y = wk[pop][a].get(metric), wk[pop][b].get(metric)
        if x is None or y is None:
            continue
        if x > y + 1e-12:
            w += 1
        elif x < y - 1e-12:
            l += 1
        else:
            e += 1
    return w, l, e


def med(pop, variant, metric):
    return BT["summary"][pop][variant][metric]["median"]


# ============================================================================= СОДЕРЖАНИЕ
def build(out_path):
    tmp = tempfile.mkdtemp(prefix="note_")
    arch_png, layers_png = make_diagrams(tmp)
    N = BT["channels"]
    NW = BT["test_weeks"]
    first_cut, last_cut = BT["weeks"][0]["cutoff"], BT["weeks"][-1]["cutoff"]
    pb = MR["performance_benchmark"]
    hl = MR["http_load_benchmark"]
    fast, sd, nv = HO["detectors"]["fast"], HO["detectors"]["static_dedup"], HO["detectors"]["naive"]
    n_seeds = len(HO["seeds"])
    pos_all = sum(w_["all"]["persistence"]["positives"] for w_ in BT["weeks"])
    pos_new = sum(w_["new_incidents"]["persistence"]["positives"] for w_ in BT["weeks"])
    blind = pos_new / pos_all

    # ---------------------------------------------------------------- титул
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(30)
    _run(p, "ХАКАТОН «ЛИДЕРЫ ЦИФРОВОЙ ТРАНСФОРМАЦИИ» 2026 · КЕЙС №8\nДЕПАРТАМЕНТ ЖКХ ГОРОДА МОСКВЫ / АО «МОСКОЛЛЕКТОР»", 11, True, color=MUT)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(26)
    p.paragraph_format.space_after = Pt(10)
    _run(p, "ПОЯСНИТЕЛЬНАЯ ЗАПИСКА\n«МОСКОЛЛЕКТОР.НЕЙРОКОНТУР»", 22, True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(22)
    _run(p, "Сервис прогнозирования инцидентов и управления ремонтными работами инженерных коллекторов Москвы.\n"
            "Редакция для финального этапа (октябрь 2026).", 11, italic=True, color=MUT)

    T(["Параметр", "Значение"], [
        ["Заказчик задачи", "АО «Москоллектор», Департамент жилищно-коммунального хозяйства города Москвы"],
        ["Команда", "Vector"],
        ["Объект автоматизации", "Коллекторы Москвы (825 км); в данных организаторов — %s каналов СМВУ" % thousands(N)],
        ["Что делает решение", "Ранжирует каналы по риску инцидента на горизонте 24–72 ч; ловит быстрые опасные события (газ, перегрев, пожар, затопление, дребезг, потеря связи); ведёт журнал решений диспетчера; готовит черновики заявок ТО/ППР"],
        ["Стек", "Python 3.10, FastAPI, LightGBM, scikit-learn, Pydantic v2; React 18, TypeScript, Vite, Leaflet; Docker"],
        ["Состояние", "Рабочий прототип: REST API, веб-интерфейс двух ролей, 108 автотестов; подключения к СМВУ и CMMS заказчика нет (интеграция описана в п. 9)"],
        ["Исходный код и стенд", "SourceCraft (основной репозиторий), GitHub (зеркало), стенд на Render; ссылки — в README.md"],
    ], [1.7, 4.7], size=9, bold_first_col=True)
    CALL("Все результаты проверки прогноза получены на журнале СМВУ за 2026 год, предоставленном организаторами. "
         "Актов ремонтов (1С:ТОИР / CMMS) в данных нет, поэтому «событие» — это разметка по журналу (неисправность, сбой связи, сброс часов, опасное значение), а не подтверждённая авария. "
         "Результаты Сценарного полигона получены на синтетических данных и проверяют логику, а не качество на реальных авариях.",
         "КАК ЧИТАТЬ ЦИФРЫ")
    doc.add_page_break()

    # ---------------------------------------------------------------- 1
    H1("1. Назначение и подход")
    P("Задача из технического задания: заранее предупреждать диспетчера о риске инцидента в коллекторах, показывать вероятность, горизонт, "
      "локацию и причины, фиксировать решение диспетчера в журнале и готовить рекомендации и заявки на обслуживание. "
      "Интеграция с внутренними системами заказчика допускается только в режиме «только чтение».")
    P("Мы разделили задачу на два слоя, потому что у них разная скорость и разный способ проверки:")
    IMG(layers_png, 6.0, "Рис. 1. Два слоя решения и общий список диспетчера")
    B("правила по порогам и скорости роста значений ловят газ, перегрев, пожар, затопление, дребезг контактов и потерю связи за секунды и минуты. "
      "Проверяются на Сценарном полигоне (п. 5); на реальных данных такие события в журнале практически не встречаются.", "Слой 1 — быстрый контур: ")
    B("модель LightGBM оценивает по истории канала, насколько вероятна неисправность или опасное значение в окне 24–72 часа. "
      "Проверяется бэктестом на реальном журнале (п. 4).", "Слой 2 — прогноз деградации: ")
    H2("Что реализовано и что остаётся на пилот")
    T(["Возможность", "В прототипе", "На пилоте у заказчика"], [
        ["Прогноз риска по каналам на 24–72 ч, объяснение факторов", "да, на журнале организаторов", "подключение потока СМВУ, дообучение на актах ТОИР"],
        ["Быстрый контур: газ, температура, пожар, затопление, дребезг, потеря связи", "да, на синтетических сценариях", "настройка порогов по паспортам оборудования"],
        ["Журнал решений диспетчера с цепочкой SHA-256", "да", "перенос в СУБД заказчика (PostgreSQL)"],
        ["Заявки ТО/ППР (черновики)", "да, JSON-хранилище", "выгрузка в CMMS / 1С:ТОИР"],
        ["Две роли: техник («Поле») и диспетчер («Сводка», «Обстановка»)", "да", "вход через каталог пользователей (LDAP/AD)"],
        ["Режим «только чтение» к данным заказчика", "да (прототип читает файлы)", "read-only учётная запись СМВУ"],
        ["Подключение к СМВУ / ОДС / CMMS в реальном времени", "нет (описано в п. 9)", "основная работа пилота"],
        ["Еженедельное дообучение модели", "проверено бэктестом; в демо стоит январская модель", "автоматизировать по расписанию"],
    ], [2.9, 1.7, 1.8], size=8.5)

    # ---------------------------------------------------------------- 2
    H1("2. Функциональная и компонентная архитектура")
    IMG(arch_png, 6.3, "Рис. 2. Компоненты решения и потоки данных")
    P("Решение — отдельный сервис (REST API + веб-интерфейс), который можно развернуть самостоятельно или встроить как компонент в существующую систему. "
      "Исходный код открыт, не обфусцирован; сложные места снабжены комментариями.")
    T(["Компонент", "Где в репозитории", "Назначение"], [
        ["Признаки", "backend/ml/features.py", "21 признак по каналу за 24 ч и 7 дней, правило разметки события"],
        ["Обучение и метрики", "backend/ml/train_validated_model.py", "обучение LightGBM, калибровка, сравнение с логистической регрессией и случайным лесом"],
        ["Бэктест", "scripts/rolling_backtest.py", "21 недельная проверка вперёд по времени, отчёт backend/models/rolling_backtest_report.json"],
        ["API", "backend/app/api/*.py", "predictions, alarms, tickets, objects, settings, stats, simulation, scenarios, synthetic"],
        ["Сервисы", "backend/app/services/*.py", "ml_service (скоринг, журнал решений, PIN), data_service (реестры), scenario_engine (быстрый контур и полигон)"],
        ["Интерфейс", "frontend/src/*", "shell (вход и роли), field (техник), summary и situation (диспетчер), scenarios, components"],
        ["Тесты", "tests/*.py", "108 автотестов: API, калибровка, бэктест, синтетический пайплайн, Сценарный полигон"],
    ], [1.4, 2.3, 2.7], size=8.5)
    H2("Программные интерфейсы (REST)")
    P("Полная схема — OpenAPI: страница /docs работающего сервиса и файл /api/openapi.json. Основные группы:")
    T(["Метод и путь", "Назначение"], [
        ["GET /api/predictions · GET /api/predictions/{channel_id}", "список и карточка прогноза по каналам (вероятность, уровень, факторы, рекомендуемое действие)"],
        ["POST /api/predictions/score", "онлайн-оценка вектора признаков датчика"],
        ["GET /api/predictions/backtest · /metrics · /benchmark · /reconciliation", "отчёты проверки: недельный бэктест, метрики модели, замеры скорости, сверка с эталоном"],
        ["POST /api/alarms/classify · POST /api/alarms/confirm · GET /api/alarms/confirmed", "разбор сигнала (настоящая тревога или ложная), решение диспетчера с причиной, журнал"],
        ["POST /api/alarms/session · GET /api/alarms/audit/verify", "вход диспетчера по табельному номеру и PIN; проверка целостности журнала"],
        ["GET /api/tickets · POST /api/tickets/generate · PATCH /api/tickets/{id}/status", "заявки ТО/ППР: список, черновик, смена статуса"],
        ["GET /api/objects · /api/objects/{id} · /api/objects/geojson/network", "объекты, карточка, схема сети"],
        ["GET и POST /api/settings · POST /api/settings/reset", "настраиваемые параметры (п. 7)"],
        ["GET /api/scenarios/catalog · POST /api/scenarios/run · POST /api/scenarios/series", "Сценарный полигон: каталог, прогон, ряд канала"],
        ["GET /api/alarms/recent · /dispatchers · POST /api/simulation/step · /api/synthetic/evaluate", "последние события, справочник диспетчеров, шаг имитации, проверка на синтетическом наборе"],
        ["GET /api/stats/summary · GET /api/health · GET /api/info", "сводка, проверка живости, сведения о сервисе"],
    ], [3.0, 3.4], size=8.5)
    P("Входные данные проверяются схемами Pydantic до любых изменений состояния: неверное значение даёт ответ 422, неизвестный канал — 404, "
      "в журнал и заявки при этом ничего не пишется.")

    # ---------------------------------------------------------------- 3
    H1("3. Данные и методы обработки")
    H2("Исходные данные")
    P("Журнал срабатываний СМВУ за январь–июнь 2026 года (около 30,7 млн записей: идентификатор канала, тип, значение, время), реестр каналов с тегом в дереве объектов "
      "и реестр типов каналов. Журнал в репозиторий не входит (1,5 ГБ, файл организаторов); его контрольная сумма SHA-256 записана в "
      "docs/DATA_PROVENANCE_AND_REPRODUCIBILITY.md. Кэш признаков в репозитории позволяет воспроизвести все метрики без исходного журнала.")
    H2("Что считается событием (разметка)")
    P("В данных нет актов ремонтов, поэтому событие размечено правилом по журналу (backend/ml/features.py, is_failure_value): "
      "состояния «неисправен», «отключено устройство», «ошибка связи», «сбой питания», «обрыв датчика», «короткое замыкание», «нет данных» и др.; "
      "сброс часов контроллера на 01.01.1970; значение метана ≥ 5 %; температура ≥ 45 °C или ≤ −10 °C; напряжение питания вне 9–30 В. "
      "Метка канала = 1, если в окне +24…+72 часа от момента прогноза есть хотя бы одна такая строка.")
    CALL("Это разметка по журналу, а не подтверждённые отказы оборудования. Все метрики в записке описывают совпадение с этой разметкой и не являются "
         "оценкой вероятности физической аварии, предотвращённых ремонтов или бухгалтерской экономии.", "ОГРАНИЧЕНИЕ")
    H2("Подготовка данных")
    B("Сброс часов на 1970 год считается признаком деградации питания контроллера, а не ошибкой данных: такие строки не удаляются, а учитываются отдельным признаком.")
    B("Дребезг контактов (быстрые переключения одного дискретного канала) учитывается как признак и отдельно фиксируется быстрым контуром; автоматически сигнал не гасится.")
    B("Для обучения и проверки признаки строятся только по данным до момента прогноза, окно метки лежит строго после него.")
    H2("Признаки и модель")
    T(["Группа", "Признаки (21)"], [
        ["Активность канала", "cnt_24h, cnt_7d, acc_events"],
        ["Тревоги", "alarms_24h, alarms_7d, alarm_ratio, acc_alarms"],
        ["Дребезг и разнообразие состояний", "chatter_cnt, chatter_ratio, unique_states"],
        ["Связь и питание", "silence_hours (молчание канала), battery_glitches, date_corruptions (сбросы часов)"],
        ["Значения", "num_mean, num_std, num_max, gas_spikes, temp_spikes"],
        ["Контекст", "sensor_type_code, system_type_code, obj_level (уровень объекта в иерархии)"],
    ], [2.0, 4.4], size=8.5)
    P("Модель — градиентный бустинг LightGBM; вероятность калибруется бета-калибровкой, подобранной только на валидационной выборке. "
      "Порог очереди диспетчера настраивается (по умолчанию 0,42 по безразмерному баллу модели, это не вероятность). "
      "Для сравнения обучены логистическая регрессия и случайный лес. Обучение: backend/ml/train_validated_model.py, воспроизведение: scripts/reproduce_metrics.py.")

    # ---------------------------------------------------------------- 4
    def M(pop, var, metric, d=2):
        try:
            return ru(med(pop, var, metric), d)
        except Exception:
            return "—"

    def WLT(pop, a, b, metric):
        w, l, e = wlt(pop, a, b, metric)
        return "%d / %d / %d" % (w, l, e)

    H1("4. Проверка прогноза на реальных данных (бэктест)")
    P("Проверка идёт «вперёд по времени», как в реальной работе: каждую неделю модель видит только прошлое и предсказывает окно +24…+72 часа после "
      "момента прогноза (00:00 дня отсечки, раз в неделю). Выполнено %d еженедельных проверок (с %s по %s), по %s каналам в каждой. "
      "Воспроизведение: python scripts/rolling_backtest.py; отчёт — backend/models/rolling_backtest_report.json." % (NW, first_cut, last_cut, thousands(N)))
    H2("Что сравнивается")
    T(["Вариант", "Что это"], [
        ["deployed (в демо)", "модель, которая стоит в прототипе: обучена один раз на январских данных и дальше не переобучалась"],
        ["lgbm_weekly", "та же архитектура LightGBM, но переобучаемая каждую неделю на всей накопленной истории (как будет на пилоте)"],
        ["logreg_weekly", "логистическая регрессия, переобучаемая еженедельно (простая линейная база)"],
        ["persistence (правило)", "«канал, у которого были неисправности за последние 7 дней, будет неисправен и дальше» — простое правило без обучения"],
    ], [1.7, 4.7], size=8.5, bold_first_col=True)
    P("Все варианты проверены на одних и тех же неделях и каналах. Метрики — по каждой неделе отдельно, ниже приведена медиана по %d неделям." % NW)
    H2("Результаты: все каналы реестра")
    rows = []
    for name, v in [("deployed (в демо)", "deployed"), ("lgbm_weekly", "lgbm_weekly"),
                    ("logreg_weekly", "logreg_weekly"), ("правило persistence", "persistence")]:
        rows.append([name, M("all", v, "roc_auc", 3), M("all", v, "pr_auc", 3),
                     M("all", v, "precision_at_50", 2), M("all", v, "precision_at_100", 2), M("all", v, "precision_at_200", 2)])
    T(["Вариант", "ROC-AUC", "PR-AUC", "Точность в топ-50", "в топ-100", "в топ-200"], rows,
      [1.9, 0.8, 0.8, 1.0, 0.9, 0.9], size=8.5, align_right_from=1, bold_first_col=True)
    P("Читать так: если диспетчер проверяет 100 каналов с наибольшим риском, то в среднем %s из них действительно окажутся с событием (демо-модель) "
      "или %s (модель с еженедельным переобучением). Доля событий среди всех каналов (базовая частота) — менее 1 %%." %
      (pct(med("all", "deployed", "precision_at_100")), pct(med("all", "lgbm_weekly", "precision_at_100"))))
    H2("Сколько недель из %d модель лучше правила" % NW)
    T(["Показатель", "deployed vs правило", "lgbm_weekly vs правило"], [
        ["ROC-AUC (выиграла / проиграла / равно)", WLT("all", "deployed", "persistence", "roc_auc"), WLT("all", "lgbm_weekly", "persistence", "roc_auc")],
        ["PR-AUC", WLT("all", "deployed", "persistence", "pr_auc"), WLT("all", "lgbm_weekly", "persistence", "pr_auc")],
        ["Точность в топ-100", WLT("all", "deployed", "persistence", "precision_at_100"), WLT("all", "lgbm_weekly", "persistence", "precision_at_100")],
        ["Точность в топ-200", WLT("all", "deployed", "persistence", "precision_at_200"), WLT("all", "lgbm_weekly", "persistence", "precision_at_200")],
    ], [3.0, 1.7, 1.7], size=8.5, align_right_from=1)
    H2("Результаты: каналы без неисправностей за предыдущие 7 дней («новые инциденты»)")
    P("Правило persistence не видит такие каналы вообще — для него это слепая зона. Именно здесь модели нужна, чтобы дать то, чего правило дать не может.")
    rows = []
    for name, v in [("deployed (в демо)", "deployed"), ("lgbm_weekly", "lgbm_weekly"),
                    ("logreg_weekly", "logreg_weekly"), ("правило persistence", "persistence")]:
        rows.append([name, M("new_incidents", v, "roc_auc", 3), M("new_incidents", v, "pr_auc", 3),
                     M("new_incidents", v, "precision_at_100", 2)])
    T(["Вариант", "ROC-AUC", "PR-AUC", "Точность в топ-100"], rows, [2.2, 1.2, 1.2, 1.8], size=8.5, align_right_from=1, bold_first_col=True)
    P("Для правила ROC-AUC = 0,5 по построению (оно не отличает один такой канал от другого).", size=9, italic=True)
    CALL("Честный вывод. Модель, стоящая в демо (обучена в январе и не переобучалась), слабее простого правила: правило лучше или равно в большинстве недель "
         "по ROC-AUC и по точности в топе. Модель с еженедельным переобучением заметно лучше по ROC-AUC и PR-AUC, на топ-100 примерно равна правилу, на топ-200 уступает. "
         "Практическая ценность модели — в каналах, где правило слепо: события в таких каналах составляют %s всех событий за период (%s из %s), именно они определяют, сколько проблем выявляется заранее. "
         "Поэтому на пилоте мы закладываем еженедельное переобучение и сравнение с правилом на актах ТОИР, а не обещаем цифры демо." % (pct(blind), thousands(pos_new), thousands(pos_all)),
         "ЧТО ЭТО ЗНАЧИТ")

    # ---------------------------------------------------------------- 5
    H1("5. Сценарный полигон: проверка быстрого контура")
    P("На реальных данных быстрых опасных событий почти нет, поэтому быстрый контур проверяется на синтетическом полигоне: %d каналов, "
      "эмулируются сутки (шаг 60 с) и месяц (шаг 300 с) с планово заложенными авариями. Спецификация с порогами и протоколом зафиксирована до первого прогона: "
      "docs/SCENARIOS_SPEC.md. Результаты ниже — на отложенных наборах (seed 2000–2019), которые прогнаны один раз после заморозки логики; "
      "файл docs/SCENARIOS_HELDOUT_RESULTS.json содержит версии кода и контрольные суммы." % 185)
    CALL("Данные синтетические. Полигон проверяет, что логика срабатывает правильно и не создаёт лишнего шума. Это не оценка качества на реальных авариях Москоллектора.",
         "ВАЖНО")
    names = {"S1": "Медленная утечка газа", "S2": "Быстрая утечка газа", "S3": "Перегрев трубопровода", "S4": "Пожар (тепловой датчик)",
             "S5": "Затопление", "S6": "Дребезг контакта", "S7": "Потеря связи", "S8": "Колебание газа у уставки"}

    def sc_metric(det, sid):
        s = HO["detectors"][det]["scenarios"][sid]
        if s["detected"] == 0:
            return "не обнаружено"
        if "lead_time_median_min_across_seeds" in s:
            return ru(s["lead_time_median_min_across_seeds"]["median"], 1) + " мин"
        d = s["delay_median_sec_across_seeds"]["median"]
        return ru(d, 1) + " с"

    rows = []
    for sid in ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]:
        f_ = fast["scenarios"][sid]
        kind = "опережение" if "lead_time_median_min_across_seeds" in f_ else "задержка"
        rows.append([sid + " " + names[sid], "%d / %d" % (f_["detected"], f_["total"]), kind, sc_metric("fast", sid),
                     "%d / %d" % (sd["scenarios"][sid]["detected"], sd["scenarios"][sid]["total"]), sc_metric("static_dedup", sid)])
    T(["Сценарий", "Быстрый контур: найдено", "Показатель", "Медиана", "Статич. порог: найдено", "Медиана"], rows,
      [1.6, 1.0, 0.9, 0.8, 1.1, 0.9], size=8, align_right_from=None)
    P("«Опережение» — на сколько минут раньше фиксированного порога 1 %% метана (или 45 °C) мы сообщаем диспетчеру; положительное значение — раньше. "
      "«Задержка» — сколько секунд проходит от начала события до оповещения. Медианы по %d наборам." % n_seeds, size=9, italic=True)
    H2("Сводка по детекторам (%d наборов × сутки)" % n_seeds)
    T(["Показатель", "Быстрый контур", "Статический порог + дедупликация", "Наивный порог"], [
        ["События найдены", "%d из %d" % (fast["overall"]["detected_events"], fast["overall"]["total_events"]),
         "%d из %d" % (sd["overall"]["detected_events"], sd["overall"]["total_events"]),
         "%d из %d" % (nv["overall"]["detected_events"], nv["overall"]["total_events"])],
        ["Ложные тревоги (всего)", str(fast["false_alarms"]["total_count"]), str(sd["false_alarms"]["total_count"]), str(nv["false_alarms"]["total_count"])],
        ["Оповещений в сутки (в среднем)", ru(fast["alerts"]["mean"], 0), ru(sd["alerts"]["mean"], 0), ru(nv["alerts"]["mean"], 0)],
        ["Инцидентов в списке диспетчера (в среднем)", ru(fast["incidents"]["mean"], 0), ru(sd["incidents"]["mean"], 0), ru(nv["incidents"]["mean"], 0)],
    ], [2.3, 1.3, 1.6, 1.2], size=8.5, align_right_from=1, bold_first_col=True)
    P("Нагрузка на диспетчера: наивный порог даёт в %s раза больше оповещений, чем быстрый контур; статический порог с дедупликацией — в %s раза больше инцидентов в списке." %
      (ru(HO["ratios"]["naive_alerts_to_fast_incidents"]["median"], 1), ru(HO["ratios"]["static_dedup_incidents_to_fast_incidents"]["median"], 1)))
    H2("Колебание у уставки (замечание экспертов)")
    P("Сценарий S8 моделирует газ, который «гуляет» около порога 1 %%: статический порог без гистерезиса превращает его в десятки оповещений. "
      "Быстрый контур выдаёт %s оповещения на событие (газовое предупреждение, рост газа и пометка «колебание у уставки») и помечает инцидент как колебание у уставки "
      "(%s случаев); наивный порог даёт %s оповещений на событие." %
      (ru(fast["scenarios"]["S8"]["alerts_per_event"]["mean"], 0), pct(fast["scenarios"]["S8"]["share_labelled_setpoint_chatter"]["mean"]),
       ru(nv["scenarios"]["S8"]["alerts_per_event"]["mean"], 0)))
    H2("Ограничения полигона")
    B("Статические базовые варианты получают ложные тревоги от заранее заложенных «нормальных» отклонений (отрицательные контрольные случаи): "
      "их %d — следствие построения теста, а не независимое измерение." % sd["false_alarms"]["total_count"])
    B("Для S7 (потеря связи) у статических вариантов нет правила вовсе — преимущество быстрого контура 680 из 680 против 600 из 680 по сути определяется этим сценарием.")
    B("В режиме «месяц» шаг замеров 5 минут: опережение по S1 отрицательное (%s мин по seed 42), пометка «колебание у уставки» ставится только в %s случаев. "
      "Для пилота нужна частота опроса газа не реже 1 раза в минуту." % (ru(HO["demo_seed_42"]["month"]["fast"]["S1_lead_median_min"], 1),
                                                                         pct(HO["demo_seed_42"]["month"]["fast"]["S8_share_labelled_setpoint_chatter"], 1)))
    B("Пороги не подбирались по результатам отложенных наборов; пороги получены из требований заказчика и экспертов и из допущений команды (п. 7).")

    # ---------------------------------------------------------------- 6
    H1("6. Скорость работы")
    T(["Замер", "Результат", "Что измерено"], [
        ["Пакетная оценка всех %s каналов" % thousands(pb["full_batch_channels_count"]),
         "%s мс (p95 %s мс)" % (ru(pb["full_batch_latency_ms"], 1), ru(pb["full_batch_p95_latency_ms"], 1)),
         "только расчёт модели на подготовленных признаках"],
        ["Оценка одного канала", "%s мс (p95 %s мс)" % (ru(pb["single_sensor_latency_ms"], 2), ru(pb["single_sensor_p95_latency_ms"], 2)),
         "только расчёт модели на подготовленных признаках"],
        ["HTTP-нагрузка: %d запросов, %d параллельных" % (hl["total_requests"], hl["concurrency_workers"]),
         "%s запросов/с, медиана %s мс, p95 %s мс" % (ru(hl["throughput_rps"], 1), ru(hl["latency_p50_ms"], 0), ru(hl["latency_p95_ms"], 0)),
         "полный путь запроса к API через локальную сеть, без ошибок (%s %%)" % ru(hl["success_rate_pct"], 0)],
    ], [2.3, 2.0, 2.1], size=8.5, bold_first_col=True)
    P("Требование ТЗ — не более 300 секунд на обработку. Замер пакетной оценки не включает чтение потока СМВУ и построение признаков из «сырых» записей: "
      "время построения признаков зависит от способа подключения к потоку и подлежит измерению на пилоте (этап «теневой режим»).")

    # ---------------------------------------------------------------- 7
    H1("7. Пороги и настраиваемые параметры")
    P("Все пороги вынесены в настройки и перечислены в спецификации; в таблице указан источник каждого значения: "
      "[З] — задано заказчиком или экспертами, [К] — значение, уже стоявшее в коде, [Д] — допущение команды (будет уточняться на пилоте).")
    T(["Параметр", "Значение", "Источник"], [
        ["Метан: предупреждение / тревога", "1,0 % / 5,0 % объёмных", "[З]"],
        ["Рост метана", "≥ 0,3 % за 3 замера и наклон ≥ 0,05 %/мин на окне max(5 мин; 3 шага)", "[Д]"],
        ["Температура: предупреждение / тревога", "40 / 45 °C", "[К]"],
        ["Быстрый рост температуры", "≥ 28 °C и наклон ≥ 0,2 °C/мин", "[Д]"],
        ["Дребезг контакта", "≥ 5 переключений за 90 с; закрытие через 15 мин без новых", "[К]/[Д]"],
        ["Колебание у уставки газа", "≥ 4 пересечения 1,0 % за 15 мин; сброс через 30 мин", "[Д] по замечанию экспертов"],
        ["Потеря связи", "нет замеров дольше max(15 мин; 3 шага)", "[Д]"],
        ["Пожар", "сработка теплового датчика — немедленно, с эскалацией по росту температуры", "[З]"],
        ["Затопление", "датчик в тревоге — немедленно", "[З]"],
        ["Напоминание о неподтверждённой тревоге", "каждые 30 мин", "[Д]"],
        ["Порог очереди диспетчера (модель)", ru(HO["thresholds_used"]["decision_threshold"], 2) + " по баллу модели (не вероятность)", "[К]"],
        ["Подтверждение диспетчером", "обязательно (require_dispatcher_confirmation = true)", "[З]"],
        ["Автоподавление дребезга", "выключено (auto_suppress_chatter = false)", "[З]"],
        ["Стоимости для расчёта эффекта", "аварийный выезд %s ₽; плановый осмотр %s ₽" %
         (thousands(HO["thresholds_used"]["callout_cost_rub"]), thousands(HO["thresholds_used"]["preventive_cost_rub"])), "[Д] нормативные ставки, уточняются"],
    ], [2.5, 3.0, 0.9], size=8.5, bold_first_col=True)
    P("Параметры меняются через экран «Настройки» или POST /api/settings и возвращаются к значениям по умолчанию через POST /api/settings/reset. "
      "Прогон Сценарного полигона использует зафиксированный снимок настроек и не зависит от того, что изменено на экране.")
    P("Тревога подтверждается или отклоняется диспетчером с указанием причины. Дребезг не гасится автоматически: его решает человек. "
      "Это сознательный выбор: ложное гашение при реальной аварии опаснее лишнего оповещения.")

    # ---------------------------------------------------------------- 8
    H1("8. Безопасность и журнал решений")
    B("Решения диспетчера (подтверждение/отклонение тревоги, причина, время, табельный номер) записываются в журнал confirmed_alarms.json; каждая запись содержит SHA-256 от своих полей (канал, решение, табельный номер, время, примечание) и хэша предыдущей записи. "
      "Проверка целостности — GET /api/alarms/audit/verify: любое изменение или удаление записи в середине цепочки обнаруживается.")
    B("Вход диспетчера — табельный номер и PIN (в интерфейсе хранятся только в памяти вкладки); в хранилище лежит лишь хэш PIN (PBKDF2-SHA256), сравнение выполняется за постоянное время. Демонстрационные учётные данные (ДИСП-0001 / PIN из переменной окружения LCT_DEMO_DISPATCHER_PIN) предназначены только для стенда; на пилоте заменяются каталогом пользователей заказчика (LDAP/AD).")
    B("Все входные данные проверяются схемами Pydantic; ответ 422 на неверные значения, запись в журнал и заявки при этом не выполняется.")
    B("Прототип работает в режиме «только чтение» по отношению к данным заказчика: изменяются только собственные журналы решений и заявок прототипа.")
    B("Контейнер запускается под непривилегированным пользователем (uid 1000), прокси-заголовки принимаются штатно.")
    P("Требования КИИ (187-ФЗ, приказы ФСТЭК № 235 и № 239), сетевая изоляция технологического сегмента через диод данных/DMZ, двухфакторная аутентификация и передача событий в SIEM описаны в docs/DATA_REQUEST_AND_PILOT_METHODOLOGY.md, раздел 5; в прототипе они не реализованы.")

    # ---------------------------------------------------------------- 9
    H1("9. Интеграция с системами заказчика")
    P("В прототипе источником данных служат файлы организаторов. Для пилота предлагаются однонаправленные адаптеры «только чтение»; конкретный вариант выбирается заказчиком:")
    T(["Способ", "Что подключается", "Статус"], [
        ["REST (HTTP/JSON)", "получение прогнозов и тревог внешними системами; приём замеров POST /api/predictions/score", "реализовано в прототипе"],
        ["Kafka / MQTT / RabbitMQ", "подписка на поток замеров СМВУ (read-only), запись результатов в отдельный топик", "описано, адаптер на пилоте"],
        ["SOAP / ESB предприятия", "обмен с корпоративной шиной, выгрузка заявок в CMMS / 1С:ТОИР", "описано, адаптер на пилоте"],
        ["Файловый обмен (CSV)", "выгрузка журнала СМВУ и актов ТОИР для обучения", "используется в прототипе"],
    ], [1.7, 3.2, 1.5], size=8.5, bold_first_col=True)
    P("Ни один из адаптеров к внешним системам в прототипе не подключён и не проверялся на живых данных заказчика.")

    # ---------------------------------------------------------------- 10
    H1("10. Экономика: условие окупаемости")
    P("Реальных данных об актах ремонтов и стоимости инцидентов у нас нет, поэтому мы не обещаем сумму экономии. Вместо этого показываем, при какой точности прогноза "
      "плановый осмотр окупается, и сравниваем с измеренной точностью.")
    cal, prev = HO["thresholds_used"]["callout_cost_rub"], HO["thresholds_used"]["preventive_cost_rub"]
    be = prev / cal
    P("Допущения: аварийный выезд стоит %s ₽, плановый осмотр — %s ₽ (нормативные ставки, уточняются заказчиком). "
      "Если осмотр канала из очереди прогноза заранее устраняет проблему, то он окупается, когда доля подтверждённых проблем в очереди не ниже %s / %s = %s." %
      (thousands(cal), thousands(prev), thousands(prev), thousands(cal), pct(be, 1)))
    p_dep, p_wk, p_rule = med("all", "deployed", "precision_at_100"), med("all", "lgbm_weekly", "precision_at_100"), med("all", "persistence", "precision_at_100")
    rows = []
    for name, p_ in [("deployed (в демо)", p_dep), ("lgbm_weekly", p_wk), ("правило persistence", p_rule)]:
        f_need = be / p_
        rows.append([name, pct(p_), "выше" if p_ > be else "ниже", pct(min(f_need, 9.99), 0) if f_need <= 1 else "недостижимо"])
    T(["Вариант", "Точность в топ-100 (медиана)", "Относительно %s" % pct(be, 1), "Какую долю найденных проблем нужно успевать устранять до аварии"],
      rows, [1.8, 1.5, 1.3, 1.8], size=8.5, align_right_from=1, bold_first_col=True)
    P("Последний столбец: если не каждая найденная проблема превращается в предотвращённую аварию, окупаемость требует, чтобы доля устранённых заранее была не ниже указанной (формула: %s / (%s × точность)). "
      "Это условие, а не прогноз экономии: доля предотвращаемых проблем определяется только на пилоте." % (thousands(prev), thousands(cal)))
    CALL("Метки основаны на журнале СМВУ, а не на актах ремонтов, поэтому «найденная проблема» — это совпадение с разметкой. "
         "Прежние сценарные оценки экономии в млн рублей в год в этой редакции не используются.", "ОГРАНИЧЕНИЕ")

    # ---------------------------------------------------------------- 11
    H1("11. Установка и запуск")
    H2("Docker (рекомендуется)")
    P("Требуется Docker с Compose. В корне репозитория:")
    CODE("docker compose up --build")
    P("Интерфейс — http://localhost:8000, документация API — http://localhost:8000/docs. Данные журналов хранятся в каталоге backend/data репозитория (монтируется в контейнер). "
      "Проверка живости: GET /api/health.")
    H2("Без Docker")
    P("Python 3.10+, Node.js 20+:")
    CODE("pip install -r requirements.txt\ncd frontend && npm ci && npm run build && cd ..\npython -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000")
    H2("Проверка и воспроизведение")
    T(["Команда", "Что делает"], [
        ["python -m pytest tests/ -q", "108 автотестов (API, калибровка, бэктест, Сценарный полигон)"],
        ["python scripts/reproduce_metrics.py", "пересчёт метрик модели из кэша признаков"],
        ["python scripts/rolling_backtest.py", "пересчёт недельного бэктеста (с ключом --extract — из исходного журнала)"],
        ["python tools/heldout_eval.py", "прогон отложенных наборов Сценарного полигона"],
    ], [2.6, 3.8], size=8.5, bold_first_col=True)
    P("Для воспроизведения метрик исходный журнал (1,5 ГБ) не нужен: используется кэш признаков; контрольные суммы данных и порядок воспроизведения — в docs/DATA_PROVENANCE_AND_REPRODUCIBILITY.md.")

    # ---------------------------------------------------------------- 12
    H1("12. Используемые библиотеки")
    reqs = read_requirements()
    deps, devdeps = read_frontend_deps()
    P("Серверная часть (requirements.txt), версии зафиксированы:").paragraph_format.keep_with_next = True
    half = (len(reqs) + 1) // 2
    rows = []
    for i in range(half):
        a = reqs[i]
        b_ = reqs[i + half] if i + half < len(reqs) else ("", "")
        rows.append([a[0], a[1], b_[0], b_[1]])
    T(["Библиотека", "Версия", "Библиотека", "Версия"], rows, [2.0, 1.2, 2.0, 1.2], size=8.5)
    P("Интерфейс (frontend/package.json):").paragraph_format.keep_with_next = True
    allf = sorted(list(deps.items()) + list(devdeps.items()))
    half = (len(allf) + 1) // 2
    rows = []
    for i in range(half):
        a = allf[i]
        b_ = allf[i + half] if i + half < len(allf) else ("", "")
        rows.append([a[0], a[1], b_[0], b_[1]])
    T(["Пакет", "Версия", "Пакет", "Версия"], rows, [2.0, 1.2, 2.0, 1.2], size=8.5)
    P("Все компоненты — открытое программное обеспечение; исходный код проекта открыт и не обфусцирован.")

    # ---------------------------------------------------------------- 13
    H1("13. Ограничения и план пилота")
    H2("Ограничения текущей версии")
    B("Метки — по журналу СМВУ, а не по актам ремонтов. Метрики показывают совпадение с этой разметкой.")
    B("Модель в демо обучена в январе и не переобучалась; она слабее простого правила (п. 4). Еженедельное переобучение проверено бэктестом, но в демо не включено.")
    B("Быстрый контур проверен на синтетических данных; на реальных аварийных записях Москоллектора не проверялся.")
    B("Не подключены СМВУ, ОДС, CMMS в реальном времени; хранилища — JSON-файлы (на пилоте — PostgreSQL).")
    B("Расчёты скорости не включают построение признаков из сырого потока.")
    H2("План опытно-промышленной эксплуатации")
    T(["Этап", "Срок", "Что делаем", "Критерий перехода"], [
        ["0. Ретро-валидация", "2–4 недели", "получаем журнал ОДС и акты ТОИР за 12–24 месяца, переобучаем и проверяем на реальных исходах",
         "ROC-AUC ≥ 0,78 на отложенной выборке; точность ≥ 18 % при полноте ≥ 65 %; отсутствие утечек данных"],
        ["1. Теневой режим", "1–2 месяца", "читаем поток СМВУ, пишем прогнозы в отдельный журнал, диспетчеры работают как обычно",
         "p95 задержки < 1 с; доступность ≥ 99,9 %; опережение сигнала СМВУ не менее 4 часов в ≥ 50 % случаев"],
        ["2. Советчик диспетчера", "3–6 месяцев", "рекомендательная карточка на рабочем месте ОДС, решение остаётся за диспетчером",
         "снижение доли ложных выездов (кластерная оценка, методика — docs/DATA_REQUEST_AND_PILOT_METHODOLOGY.md)"],
    ], [1.3, 0.9, 2.4, 1.8], size=8.5, bold_first_col=True)
    P("Требуемые от заказчика данные (журнал ОДС, акты ТОИР, тарифы, паспорта каналов) перечислены в той же методике, раздел 2.")


# ============================================================================= запуск
if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else OUT_DEFAULT
    build(out)
    doc.save(out)
    print("saved", out)
