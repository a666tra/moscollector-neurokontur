import React, { useMemo, useState } from 'react';
import { ObjectItem, PredictionItem, ConfirmedAlarmItem } from '../types';
import { NetworkMap } from './NetworkMap';
import { RiskQueue } from './RiskQueue';
import { ChannelInspector } from './ChannelInspector';

interface Props {
  objects: ObjectItem[];
  predictions: PredictionItem[];
  confirmed: ConfirmedAlarmItem[];
  onChanged: () => void;
}

/** «Обстановка»: map + ranked risk queue + channel card — one flow for the dispatcher scenario (ТЗ §12). */
export const Situation: React.FC<Props> = ({ objects, predictions, confirmed, onChanged }) => {
  const [objectId, setObjectId] = useState<string | undefined>();
  const [selected, setSelected] = useState<PredictionItem | null>(null);
  const [decided, setDecided] = useState<Record<string, string>>({});

  const objectsById = useMemo(() => Object.fromEntries(objects.map(o => [o.object_id, o])), [objects]);
  const history = useMemo(() => (selected ? confirmed.filter(c => c.channel_id === selected.channel_id) : []), [confirmed, selected]);

  const selectChannel = (p: PredictionItem) => { setSelected(p); setObjectId(prev => prev ?? undefined); };
  const selectObject = (id: string) => { setObjectId(id); setSelected(null); };

  const inspector = selected && (
    <ChannelInspector
      item={selected}
      object={objectsById[selected.object_id]}
      history={history}
      onClose={() => setSelected(null)}
      onDecided={(cid, text) => { setDecided(d => ({ ...d, [cid]: text })); onChanged(); }}
    />
  );

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row">
      <div className="relative h-[42vh] lg:h-auto lg:flex-1 min-w-0 shrink-0">
        <NetworkMap objects={objects} selectedObjectId={objectId ?? selected?.object_id} onSelectObject={selectObject} />
        {selected && (
          <div className="hidden lg:flex absolute top-3 right-16 z-[600] w-[400px] max-h-[calc(100%-24px)] panel shadow-2xl"
               style={{ background: 'var(--surface)' }}>
            {inspector}
          </div>
        )}
      </div>
      <aside className="flex-1 lg:flex-none lg:w-[380px] min-h-0 border-t lg:border-t-0 lg:border-l" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        <RiskQueue
          items={predictions}
          objectsById={objectsById}
          selectedChannelId={selected?.channel_id}
          objectFilter={objectId}
          onClearObject={() => setObjectId(undefined)}
          onSelect={selectChannel}
          decided={decided}
        />
      </aside>
      {selected && (
        <div className="lg:hidden fixed inset-0 z-[1200] flex items-end bg-black/60" onClick={() => setSelected(null)}>
          <div className="w-full max-h-[88vh] flex rounded-t-2xl border-t" onClick={e => e.stopPropagation()}
               style={{ background: 'var(--surface)', borderColor: 'var(--line-2)' }}>
            {inspector}
          </div>
        </div>
      )}
    </div>
  );
};
