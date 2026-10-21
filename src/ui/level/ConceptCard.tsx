import { BAPU } from '../../bapu/BapuBubble';
import type { LevelDef } from '../../levels/types';

export function ConceptCard({ level, onContinue }: { level: LevelDef; onContinue: () => void }) {
  return (
    <div className="concept">
      <div className="concept-portrait">
        <img src={BAPU.portrait} alt="Bapu the ape, in a suit and glasses" />
        <span className="concept-level">Level {level.number}</span>
      </div>

      <div className="concept-body">
        <h1>{level.title}</h1>
        <blockquote className="concept-quote">“{level.concept}”</blockquote>

        {level.glossary && (
          <div className="glossary">
            <span className="glossary-tag">New word</span>
            <p>
              <strong>{level.glossary.term}:</strong> {level.glossary.definition}
            </p>
          </div>
        )}
      </div>

      <div className="play-actions">
        <button className="btn btn-block" onClick={onContinue}>
          Show me how
        </button>
      </div>
    </div>
  );
}
