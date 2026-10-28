import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import type { Screen } from '../navigation/types';
import {
  createdAssociations,
  createdSentences,
  lvCountLabel,
} from '../utils/createdWork';

interface CreatedWorkScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

function formatCreatedWhen(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' });
}

/** Short list of the sections that have a created-work record. */
export function CreatedWorkScreen({
  onNavigate,
  onBack,
  onHome,
}: CreatedWorkScreenProps) {
  const { attempts } = useApp();
  const sentenceCount = createdSentences(attempts).length;
  const associationCount = createdAssociations(attempts).length;

  return (
    <Layout onHome={onHome}>
      <div className="account-panel stack">
        <p className="lead account-copy">Progress</p>
        <div className="account-folds">
          <button
            type="button"
            className="account-fold account-fold-sentences"
            onClick={() =>
              onNavigate({ name: 'created_work_list', section: 'sentences' })
            }
          >
            <span className="account-fold-label">Veido teikumu</span>
            <span className="account-fold-value">
              {lvCountLabel(sentenceCount, 'teikums', 'teikumi', 'teikumu')}
            </span>
          </button>
          <button
            type="button"
            className="account-fold account-fold-associations"
            onClick={() =>
              onNavigate({
                name: 'created_work_list',
                section: 'associations',
              })
            }
          >
            <span className="account-fold-label">Asociācijas</span>
            <span className="account-fold-value">
              {lvCountLabel(
                associationCount,
                'asociācija',
                'asociācijas',
                'asociāciju',
              )}
            </span>
          </button>
        </div>
        <Button variant="neutral" onClick={onBack}>
          Atpakaļ uz kontu
        </Button>
      </div>
    </Layout>
  );
}

interface CreatedWorkListScreenProps {
  section: 'sentences' | 'associations';
  onBack: () => void;
  onHome: () => void;
}

/** One section’s created sentences or associations. */
export function CreatedWorkListScreen({
  section,
  onBack,
  onHome,
}: CreatedWorkListScreenProps) {
  const { attempts } = useApp();
  const sentences = section === 'sentences' ? createdSentences(attempts) : [];
  const associations =
    section === 'associations' ? createdAssociations(attempts) : [];
  const title = section === 'sentences' ? 'Veido teikumu' : 'Asociācijas';
  const empty =
    section === 'sentences'
      ? 'Vēl nav izveidotu teikumu.'
      : 'Vēl nav izveidotu asociāciju.';
  const hasItems =
    section === 'sentences' ? sentences.length > 0 : associations.length > 0;

  return (
    <Layout onHome={onHome}>
      <div className="account-panel stack">
        <p className="lead account-copy">{title}</p>
        {hasItems ? (
          <ul className="account-created-list">
            {section === 'sentences'
              ? sentences.map((item) => {
                  const when = formatCreatedWhen(item.at);
                  return (
                    <li key={item.taskId} className="account-created-item">
                      <p className="account-created-text" lang="lv">
                        {item.sentence}
                      </p>
                      {item.cue || when ? (
                        <p className="account-created-meta">
                          {item.cue ? <span>{item.cue}</span> : null}
                          {when ? <span>{when}</span> : null}
                        </p>
                      ) : null}
                    </li>
                  );
                })
              : associations.map((item) => {
                  const when = formatCreatedWhen(item.at);
                  return (
                    <li key={item.taskId} className="account-created-item">
                      <p className="account-created-cue" lang="lv">
                        {item.brand}
                      </p>
                      <p className="account-created-text" lang="lv">
                        {item.association}
                      </p>
                      {when ? (
                        <p className="account-created-meta">
                          <span>{when}</span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
          </ul>
        ) : (
          <p className="muted account-copy">{empty}</p>
        )}
        <Button variant="neutral" onClick={onBack}>
          Atpakaļ
        </Button>
      </div>
    </Layout>
  );
}
