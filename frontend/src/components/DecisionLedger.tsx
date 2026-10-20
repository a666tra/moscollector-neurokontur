import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, 
  Link as LinkIcon, Info, Check, X, ShieldAlert 
} from 'lucide-react';
import { ConfirmedAlarmItem, AuditVerificationResult } from '../types';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';

interface DecisionLedgerProps {
  className?: string;
  onRefresh?: () => void;
}

export const DecisionLedger: React.FC<DecisionLedgerProps> = ({ className = '', onRefresh }) => {
  const toast = useToast();
  const [items, setItems] = useState<ConfirmedAlarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [audit, setAudit] = useState<AuditVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tamper, setTamper] = useState(false);
  const [verifiedStep, setVerifiedStep] = useState<number>(-1);
  const [blockStatus, setBlockStatus] = useState<boolean[]>([]);
  const [hasVerifiedOnce, setHasVerifiedOnce] = useState(false);
  // Real (non-demo) failure: the server or the per-block check reported a broken chain
  const [realBroken, setRealBroken] = useState(false);
  const [brokenAt, setBrokenAt] = useState<number | null>(null);
  // The server did not confirm the whole chain (no verdict, or it checked fewer records than shown)
  const [unverified, setUnverified] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await api<ConfirmedAlarmItem[]>('/api/alarms/confirmed');
      setItems(data || []);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    api<AuditVerificationResult>('/api/alarms/audit/verify')
      .then(setAudit)
      .catch(() => {});
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifiedStep(0);
    setBlockStatus([]);
    setRealBroken(false);
    setBrokenAt(null);
    setUnverified(null);

    try {
      const res = await api<AuditVerificationResult>('/api/alarms/audit/verify');
      setAudit(res);

      const count = items.length;
      if (typeof res?.is_valid !== 'boolean') {
        // No verdict from the server: say so, never imply the chain was checked
        setUnverified('сервер не вернул результат проверки');
        setHasVerifiedOnce(true);
        toast('Не удалось проверить цепочку: сервер не вернул результат', 'error');
        return;
      }
      const checkedByServer =
        typeof res.total_records === 'number' ? res.total_records : res.details?.length ?? 0;
      if (checkedByServer !== count) {
        setUnverified(`сервер проверил ${checkedByServer} из ${count} записей`);
      }
      const statuses: boolean[] = [];

      // Step-by-step verification animation for the visual chain
      for (let i = 0; i < count; i++) {
        await new Promise(r => setTimeout(r, 120));
        // If tamper is simulated on index 2 (item #3)
        const isTamperedBlock = tamper && i === Math.min(2, count - 1);
        // API details are chronological (oldest first); the list is newest first.
        // A missing result is never treated as success.
        let blockOk: boolean;
        if (res.details && res.details.length === count) {
          const d = res.details[count - 1 - i];
          blockOk = !!d && d.link_valid === true && d.hash_valid === true;
        } else {
          blockOk = res.is_valid === true;
        }
        const isValid = !isTamperedBlock && blockOk;
        statuses.push(isValid);
        setVerifiedStep(i + 1);
        setBlockStatus([...statuses]);

        if (!isValid) {
          // Chain broke at this point
          break;
        }
      }

      const firstBad = statuses.findIndex((s) => !s);
      const broken = !tamper && (res.is_valid !== true || res.tamper_detected === true || firstBad !== -1);
      setRealBroken(broken);
      setBrokenAt(firstBad !== -1 && res.details?.length === count ? firstBad : null);
      setHasVerifiedOnce(true);

      if (tamper) {
        toast('Демо: подмена показана только на экране, в журнале ничего не менялось.', 'info');
      } else if (!broken && checkedByServer === count) {
        toast(`Цепочка проверена: ${count} блоков валидны`, 'success');
      } else if (!broken) {
        toast(`Проверена не вся цепочка: сервер проверил ${checkedByServer} из ${count}`, 'info');
      } else {
        toast('Нарушена целостность цепочки аудита решений!', 'error');
      }
    } catch (e: any) {
      toast(e?.message || 'Не удалось проверить цепочку аудита', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const toggleTamper = () => {
    const nextTamper = !tamper;
    setTamper(nextTamper);
    setVerifiedStep(-1);
    setBlockStatus([]);
    setHasVerifiedOnce(false);
    setRealBroken(false);
    setBrokenAt(null);
    setUnverified(null);
  };

  const tamperedIndex = Math.min(2, Math.max(0, items.length - 1));
  const isChainTampered = (tamper || realBroken) && hasVerifiedOnce;

  return (
    <section
      className={`rounded-[24px] border border-[var(--ln)] p-4 sm:p-6 space-y-4 sm:space-y-5 ${className}`}
      style={{ background: 'var(--sf)', boxShadow: 'var(--sh)' }}
    >
      {/* Title & Explanation */}
      <div className="pb-3 border-b flex flex-col sm:flex-row sm:items-start justify-between gap-3" style={{ borderColor: 'var(--ln)' }}>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="serif text-2xl sm:text-3xl font-normal leading-none" style={{ color: 'var(--ink)' }}>
              Журнал решений
            </h2>
            <span
              className="chip text-[12px] h-6 px-2.5 rounded-full font-bold"
              style={{ background: 'var(--sf2)', color: 'var(--ink)' }}
            >
              Журнал нельзя тихо переписать
            </span>
          </div>
          <p className="text-xs sm:text-[13.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--mu)' }}>
            Криптографический реестр решений диспетчера с хеш-цепочкой SHA-256: каждое действие неразрывно связано с предыдущим.
          </p>
        </div>

        {/* Verification & Tamper Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || items.length === 0}
            className="btn btn-primary h-10 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            <span>
              {verifying
                ? `Проверяем ${Math.min(verifiedStep, items.length)} из ${items.length}…`
                : 'Проверить целостность цепочки'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleTamper}
            className="h-10 px-3 text-xs sm:text-sm font-semibold text-[var(--ac)] hover:bg-[var(--sf2)] rounded-full transition-colors cursor-pointer border-0 bg-transparent"
          >
            {tamper ? 'Вернуть как было' : 'Показать, как выглядит подмена (демо)'}
          </button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {hasVerifiedOnce && (
        <div
          role="status"
          className="p-3.5 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-semibold animate-[nkUp_0.25s_ease-out]"
          style={{
            background: isChainTampered ? 'var(--rds)' : unverified ? 'var(--ams)' : 'var(--gns)',
            borderColor: isChainTampered ? 'var(--rd)' : unverified ? 'var(--am)' : 'var(--gn)',
            color: isChainTampered ? 'var(--rdt)' : unverified ? 'var(--amt)' : 'var(--gnt)',
          }}
        >
          {isChainTampered ? (
            <>
              <ShieldAlert className="w-5 h-5 shrink-0 text-[var(--rd)]" />
              <span>
                {realBroken
                  ? `Нарушена целостность журнала${brokenAt !== null ? `: запись №${brokenAt + 1} не прошла проверку` : ''}. Передайте журнал администратору.`
                  : `ДЕМО: так цепочка покажет подмену. Мы изменили запись №${tamperedIndex + 1} только на этом экране — настоящие данные не тронуты.`}
              </span>
            </>
          ) : unverified ? (
            <>
              <ShieldAlert className="w-5 h-5 shrink-0 text-[var(--am)]" />
              <span>
                Цепочка не подтверждена полностью: {unverified}.
                {unverified.startsWith('сервер проверил') ? ' Нарушений в проверенной части не найдено.' : ''}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--gn)]" />
              <span>
                Цепочка цела: проверено записей — {items.length}, все отпечатки совпали.
              </span>
            </>
          )}
        </div>
      )}

      {/* Money Disclaimer Note */}
      <div className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: 'var(--mu)' }}>
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-[var(--mu)]" />
        <span>
          <b style={{ color: 'var(--ink)' }}>Норматив вызова</b> — справочная расчетная стоимость экстренного выезда по нормативам регламента ТОиР, не подтверждённая экономия.
        </span>
      </div>

      {/* Visible Vertical Chain List */}
      {loading ? (
        <div className="p-8 text-center text-xs" style={{ color: 'var(--mu)' }}>
          Загрузка журнала решений…
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-xs" style={{ color: 'var(--mu)' }} role={loadFailed ? 'alert' : undefined}>
          {loadFailed ? 'Не удалось загрузить журнал решений. Обновите страницу.' : 'За текущую смену решений пока не зафиксировано'}
        </div>
      ) : (
        <ol className="space-y-0 list-none p-0 m-0" role="list">
          {items.map((rec, i) => {
            const isTamperedRow = tamper && i === tamperedIndex;
            const isFalse = isTamperedRow
              ? !(rec.decision ?? '').includes('FALSE')
              : (rec.decision ?? '').includes('FALSE');

            // Verification status for this block
            const isChecked = verifiedStep > i;
            const isValid = isChecked ? blockStatus[i] : null;

            const nodeBg =
              isValid === true
                ? 'var(--gn)'
                : isValid === false
                ? 'var(--rd)'
                : isTamperedRow
                ? 'var(--rds)'
                : 'var(--sf2)';

            const nodeColor = isValid !== null ? '#ffffff' : 'var(--mu)';
            const nodeBorder = isTamperedRow ? '2px solid var(--rd)' : 'none';

            return (
              <li
                key={i}
                className="grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[44px_minmax(0,1fr)] gap-3 sm:gap-4 items-stretch"
              >
                {/* Left Chain Pillar */}
                <div className="flex flex-col items-center">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 shadow-sm"
                    style={{
                      background: nodeBg,
                      color: nodeColor,
                      border: nodeBorder,
                    }}
                    title={
                      isValid === true
                        ? 'Блок проверен и валиден'
                        : isValid === false
                        ? 'Ошибка хеша блока!'
                        : 'Звено цепочки'
                    }
                  >
                    {isValid === true ? (
                      <Check className="w-4 h-4" strokeWidth={3} />
                    ) : isValid === false ? (
                      <X className="w-4 h-4" strokeWidth={3} />
                    ) : (
                      <LinkIcon className="w-3.5 h-3.5" />
                    )}
                  </span>

                  {/* Vertical connecting bar */}
                  {i < items.length - 1 && (
                    <i
                      className="w-[3px] flex-1 my-1 rounded-full transition-colors duration-200 min-h-[24px]"
                      style={{
                        background:
                          isValid === false
                            ? 'var(--rd)'
                            : isValid === true && blockStatus[i + 1] === true
                            ? 'var(--gn)'
                            : 'var(--ln)',
                      }}
                    />
                  )}
                </div>

                {/* Right Card Content */}
                <div
                  className={`rounded-2xl border p-3 sm:p-3.5 mb-3 transition-colors ${
                    isTamperedRow ? 'border-[var(--rd)] bg-[var(--rds)]' : 'border-[var(--ln)] bg-[var(--sf)]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
                    {/* Timestamp + Channel */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--mu)' }}>
                        {rec.timestamp}
                      </span>
                      <span className="font-semibold text-xs sm:text-sm" style={{ color: 'var(--ink)' }}>
                        Канал <span className="num font-bold text-[var(--ac)]">#{rec.channel_id}</span>
                      </span>
                      {isTamperedRow && (
                        <span className="chip text-[11px] h-5 px-2 bg-[var(--rd)] text-[var(--onrd)] font-bold">
                          ДЕМО: подмена
                        </span>
                      )}
                    </div>

                    {/* Decision Chip */}
                    <div className="flex items-center gap-2">
                      <span
                        className="chip text-xs h-6 px-2.5 rounded-full font-bold"
                        style={{
                          background: isFalse ? 'var(--gns)' : 'var(--rds)',
                          color: isFalse ? 'var(--gnt)' : 'var(--rdt)',
                        }}
                      >
                        {isFalse ? 'Отмена выезда' : 'Выезд назначен'}
                      </span>
                    </div>
                  </div>

                  {/* Dispatcher + Callout Cost */}
                  <div className="mt-2 pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs" style={{ borderColor: 'var(--ln)' }}>
                    <div style={{ color: 'var(--mu)' }}>
                      Диспетчер: <b className="num" style={{ color: 'var(--ink)' }}>{rec.dispatcher_badge}</b>
                      {rec.dispatcher_name && (
                        <span className="ml-1" style={{ color: 'var(--mu)' }}>
                          ({(rec.dispatcher_name ?? '').split(' ')[0]})
                        </span>
                      )}
                    </div>

                    {rec.avoided_cost_rub ? (
                      <div className="num" style={{ color: 'var(--mu)' }}>
                        Норматив вызова: <b style={{ color: 'var(--ink)' }}>{typeof rec.avoided_cost_rub === 'number' ? `${rec.avoided_cost_rub.toLocaleString('ru-RU')} ₽` : '—'}</b>
                      </div>
                    ) : null}
                  </div>

                  {/* SHA-256 Hash */}
                  <div
                    className="mt-2 text-[11px] font-mono truncate"
                    style={{ color: 'var(--mu)' }}
                    title={rec.record_hash}
                  >
                    SHA-256: <span className="text-[var(--ink)]">{rec.record_hash ? rec.record_hash : 'genesis-block'}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
