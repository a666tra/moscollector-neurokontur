import React, { useEffect, useState } from 'react';
import { FileCheck, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ConfirmedAlarmItem, AuditVerificationResult } from '../types';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';

interface DecisionLedgerProps {
  className?: string;
  onRefresh?: () => void;
}

export const DecisionLedger: React.FC<DecisionLedgerProps> = ({ className = '' }) => {
  const toast = useToast();
  const [items, setItems] = useState<ConfirmedAlarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadData = async () => {
    try {
      const data = await api<ConfirmedAlarmItem[]>('/api/alarms/confirmed');
      setItems(data || []);
    } catch {
      // silently handle initial load failure
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const res = await api<AuditVerificationResult>('/api/alarms/audit/verify');
      setAudit(res);
      if (res.is_valid) {
        toast(`Цепочка аудита проверена: ${res.chain_length} блоков валидны`, 'success');
      } else {
        toast('Нарушена целостность цепочки аудита решений!', 'error');
      }
    } catch (e: any) {
      toast(e?.message || 'Не удалось проверить цепочку аудита', 'error');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadData();
    api<AuditVerificationResult>('/api/alarms/audit/verify')
      .then(setAudit)
      .catch(() => {});
  }, []);

  const totalAvoided = items.reduce((acc, h) => acc + (h.avoided_cost_rub || 0), 0);

  return (
    <section className={`panel p-4 sm:p-5 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)' }}>
            <FileCheck className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">Журнал решений смены</h3>
              <span className="chip" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                Цепочка SHA-256
              </span>
              {audit && (
                <span className={`chip ${audit.is_valid ? 'risk-NORMAL' : 'risk-CRITICAL'}`}>
                  {audit.is_valid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Валидна (<span className="num">{audit.chain_length}</span> блоков)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      <span>Ошибка валидации</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Криптографический реестр подтверждений и отмен выездов дежурным диспетчером
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {totalAvoided > 0 && (
            <div className="text-right hidden md:block">
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Сценарная экономия</div>
              <div className="num text-xs font-semibold" style={{ color: 'var(--ok)' }}>
                +{totalAvoided.toLocaleString('ru-RU')} ₽
              </div>
            </div>
          )}
          <button
            onClick={verifyChain}
            disabled={verifying}
            className="btn btn-secondary text-xs h-8"
            title="Проверить целостность хеш-цепочки решений"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Проверка…' : 'Проверить цепочку'}</span>
          </button>
        </div>
      </div>

      {/* Desktop Table (≥ 640px) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
              <th className="py-2.5 px-3 font-medium">Время</th>
              <th className="py-2.5 px-3 font-medium">Канал</th>
              <th className="py-2.5 px-3 font-medium">Решение</th>
              <th className="py-2.5 px-3 font-medium">Диспетчер</th>
              <th className="py-2.5 px-3 font-medium text-right">Сумма</th>
              <th className="py-2.5 px-3 font-medium">Хеш блока</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center" style={{ color: 'var(--muted)' }}>
                  Загрузка журнала решений…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center" style={{ color: 'var(--muted)' }}>
                  За текущую смену решений пока не зафиксировано
                </td>
              </tr>
            ) : (
              items.map((rec, i) => {
                const isFalse = rec.decision.includes('FALSE');
                return (
                  <tr key={i} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="py-2.5 px-3 num">{rec.timestamp}</td>
                    <td className="py-2.5 px-3 font-medium">
                      <span className="num" style={{ color: 'var(--attn)' }}>#{rec.channel_id}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`chip ${isFalse ? 'risk-NORMAL' : 'risk-CRITICAL'}`}>
                        {isFalse ? 'Отмена выезда' : 'Выезд назначен'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="num font-medium">{rec.dispatcher_badge}</span>
                      {rec.dispatcher_name && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>
                          ({rec.dispatcher_name.split(' ')[0]})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right num font-semibold" style={{ color: 'var(--ok)' }}>
                      {rec.avoided_cost_rub ? `+${rec.avoided_cost_rub.toLocaleString('ru-RU')} ₽` : '—'}
                    </td>
                    <td className="py-2.5 px-3 num font-mono text-[11px]" style={{ color: 'var(--faint)' }} title={rec.record_hash}>
                      {rec.record_hash ? `${rec.record_hash.substring(0, 16)}…` : 'genesis'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Rows (< 640px) */}
      <div className="sm:hidden space-y-2.5">
        {loading ? (
          <div className="py-6 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Загрузка журнала решений…
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs" style={{ color: 'var(--muted)' }}>
            За текущую смену решений пока не зафиксировано
          </div>
        ) : (
          items.map((rec, i) => {
            const isFalse = rec.decision.includes('FALSE');
            return (
              <div key={i} className="p-3 rounded-lg border space-y-2" style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="num text-xs font-semibold" style={{ color: 'var(--attn)' }}>#{rec.channel_id}</span>
                    <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>{rec.timestamp}</span>
                  </div>
                  <span className={`chip ${isFalse ? 'risk-NORMAL' : 'risk-CRITICAL'}`}>
                    {isFalse ? 'Отмена выезда' : 'Выезд назначен'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t" style={{ borderColor: 'var(--line)' }}>
                  <div style={{ color: 'var(--muted)' }}>
                    Диспетчер: <span className="num text-[var(--text)]">{rec.dispatcher_badge}</span>
                  </div>
                  {rec.avoided_cost_rub ? (
                    <div className="num font-semibold" style={{ color: 'var(--ok)' }}>
                      +{rec.avoided_cost_rub.toLocaleString('ru-RU')} ₽
                    </div>
                  ) : null}
                </div>

                <div className="text-[10px] num font-mono truncate" style={{ color: 'var(--faint)' }} title={rec.record_hash}>
                  Хеш: {rec.record_hash ? rec.record_hash : 'genesis'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
