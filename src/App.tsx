import { useMemo, useState } from 'react'
import questionsData from '../questions.json'
import heroArtwork from '../jpeg-core.png'
import './App.css'

type Screen = 'landing' | 'board-select' | 'board'
type GameMode = 'single' | 'versus'
type TeamKey = 'teamA' | 'teamB'

interface RawClue {
  points: number
  question: string
  answer: string
}

interface RawBoard {
  board_number: number
  categories: Record<string, RawClue[]>
}

interface RawQuestionsFile {
  jeopardy_game: RawBoard[]
}

interface Clue {
  id: string
  categoryLabel: string
  points: number
  question: string
  answer: string
}

interface Category {
  key: string
  label: string
  colorClass: string
  clues: Clue[]
}

interface Board {
  boardNumber: number
  categories: Category[]
}

interface ScoreState {
  single: number
  teamA: number
  teamB: number
}

interface AnswerLogEntry {
  clueId: string
  clueLabel: string
  teamLabel: string
  playerLabel: string
  pointsDelta: number
}

const CATEGORY_LAYOUT = [
  { key: 'Art', label: 'Art', colorClass: 'cat-art' },
  { key: 'Games', label: 'Games', colorClass: 'cat-games' },
  { key: 'Trends or Memes', label: 'Trends/Memes', colorClass: 'cat-trends' },
  { key: 'JPEG', label: 'About JPEG', colorClass: 'cat-jpeg' },
  { key: 'Cre8Con', label: 'Cre8Con', colorClass: 'cat-cre8con' },
] as const

const PLAYER_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const

const gameFile = questionsData as RawQuestionsFile

const BOARDS: Board[] = gameFile.jeopardy_game.map((board) => ({
  boardNumber: board.board_number,
  categories: CATEGORY_LAYOUT.map((category) => {
    const clues = (board.categories[category.key] ?? [])
      .slice()
      .sort((left, right) => left.points - right.points)
      .map((clue, index) => ({
        id: `${board.board_number}-${category.key}-${clue.points}`,
        categoryLabel: category.label,
        points: (index + 1) * 100,
        question: clue.question,
        answer: clue.answer,
      }))

    return {
      key: category.key,
      label: category.label,
      colorClass: category.colorClass,
      clues,
    }
  }),
}))

function createUsedClueMap() {
  return Object.fromEntries(BOARDS.map((board) => [board.boardNumber, [] as string[]]))
}

function createInitialScores(): ScoreState {
  return {
    single: 0,
    teamA: 0,
    teamB: 0,
  }
}

function createInitialTeamPlayerScores(
  teamAPlayerCount = 1,
  teamBPlayerCount = 1,
): Record<TeamKey, number[]> {
  return {
    teamA: Array.from({ length: teamAPlayerCount }, () => 0),
    teamB: Array.from({ length: teamBPlayerCount }, () => 0),
  }
}

function formatPlayerCount(playerCount: number) {
  return playerCount === 1 ? '1 Player' : `${playerCount} Players`
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [gameMode, setGameMode] = useState<GameMode>('single')
  const [singlePlayerName, setSinglePlayerName] = useState('Player 1')
  const [teamAName, setTeamAName] = useState('Team A')
  const [teamBName, setTeamBName] = useState('Team B')
  const [teamAPlayerCount, setTeamAPlayerCount] = useState(1)
  const [teamBPlayerCount, setTeamBPlayerCount] = useState(1)
  const [teamPlayerNames, setTeamPlayerNames] = useState<Record<TeamKey, string[]>>({
    teamA: [''],
    teamB: [''],
  })
  const [teamPlayerScores, setTeamPlayerScores] = useState<Record<TeamKey, number[]>>(
    createInitialTeamPlayerScores,
  )
  const [selectedResponderByTeam, setSelectedResponderByTeam] = useState<Record<TeamKey, number>>({
    teamA: 0,
    teamB: 0,
  })
  const [scores, setScores] = useState<ScoreState>(createInitialScores)
  const [activeBoardNumber, setActiveBoardNumber] = useState<number | null>(null)
  const [rulesBoardNumber, setRulesBoardNumber] = useState<number | null>(null)
  const [activeClue, setActiveClue] = useState<Clue | null>(null)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [isResetPromptOpen, setIsResetPromptOpen] = useState(false)
  const [answerLog, setAnswerLog] = useState<AnswerLogEntry[]>([])
  const [usedCluesByBoard, setUsedCluesByBoard] = useState<Record<number, string[]>>(
    createUsedClueMap,
  )

  const singlePlayerLabel = singlePlayerName.trim() || 'Player 1'
  const teamALabel = teamAName.trim() || 'Team A'
  const teamBLabel = teamBName.trim() || 'Team B'

  const isVersusConfigValid =
    teamAPlayerCount >= 1 &&
    teamAPlayerCount <= 5 &&
    teamBPlayerCount >= 1 &&
    teamBPlayerCount <= 5 &&
    teamAPlayerCount === teamBPlayerCount

  const canChooseBoard = gameMode === 'single' || isVersusConfigValid

  const getTeamPlayerLabel = (teamKey: TeamKey, playerIndex: number) => {
    const teamLabel = teamKey === 'teamA' ? teamALabel : teamBLabel
    const customName = teamPlayerNames[teamKey][playerIndex]?.trim() ?? ''
    return customName || `${teamLabel} Player ${playerIndex + 1}`
  }

  const teamAPlayerLabels = Array.from({ length: teamAPlayerCount }, (_, playerIndex) =>
    getTeamPlayerLabel('teamA', playerIndex),
  )
  const teamBPlayerLabels = Array.from({ length: teamBPlayerCount }, (_, playerIndex) =>
    getTeamPlayerLabel('teamB', playerIndex),
  )

  const updateTeamPlayerCount = (teamKey: TeamKey, nextCount: number) => {
    if (teamKey === 'teamA') {
      setTeamAPlayerCount(nextCount)
    } else {
      setTeamBPlayerCount(nextCount)
    }

    setTeamPlayerNames((previousNames) => {
      const resizedNames = (previousNames[teamKey] ?? []).slice(0, nextCount)
      while (resizedNames.length < nextCount) {
        resizedNames.push('')
      }

      return {
        ...previousNames,
        [teamKey]: resizedNames,
      }
    })

    setSelectedResponderByTeam((previousSelection) => ({
      ...previousSelection,
      [teamKey]: Math.min(previousSelection[teamKey], nextCount - 1),
    }))
  }

  const updateTeamPlayerName = (teamKey: TeamKey, playerIndex: number, value: string) => {
    setTeamPlayerNames((previousNames) => {
      const nextTeamNames = [...(previousNames[teamKey] ?? [])]
      nextTeamNames[playerIndex] = value

      return {
        ...previousNames,
        [teamKey]: nextTeamNames,
      }
    })
  }

  const activeBoard = useMemo(
    () => BOARDS.find((board) => board.boardNumber === activeBoardNumber) ?? null,
    [activeBoardNumber],
  )

  const activeUsedClues = activeBoardNumber
    ? (usedCluesByBoard[activeBoardNumber] ?? [])
    : []

  const remainingCount = activeBoard
    ? activeBoard.categories.reduce((count, category) => {
        return (
          count + category.clues.filter((clue) => !activeUsedClues.includes(clue.id)).length
        )
      }, 0)
    : 0

  const totalClueCount = activeBoard
    ? activeBoard.categories.reduce((count, category) => count + category.clues.length, 0)
    : 0

  const boardIsComplete = activeBoard !== null && remainingCount === 0

  const openRulesModal = (boardNumber: number) => {
    if (gameMode === 'versus' && !isVersusConfigValid) {
      return
    }

    setRulesBoardNumber(boardNumber)
  }

  const closeRulesModal = () => {
    setRulesBoardNumber(null)
  }

  const proceedToBoard = () => {
    if (rulesBoardNumber === null) {
      return
    }

    if (gameMode === 'versus' && !isVersusConfigValid) {
      return
    }

    setActiveBoardNumber(rulesBoardNumber)
    setScreen('board')
    setScores(createInitialScores())
    setTeamPlayerScores(createInitialTeamPlayerScores(teamAPlayerCount, teamBPlayerCount))
    setAnswerLog([])
    setSelectedResponderByTeam({
      teamA: 0,
      teamB: 0,
    })
    setActiveClue(null)
    setAnswerVisible(false)
    setIsResetPromptOpen(false)
    setUsedCluesByBoard((previousState) => ({
      ...previousState,
      [rulesBoardNumber]: [],
    }))
    setRulesBoardNumber(null)
  }

  const performActiveBoardReset = () => {
    if (activeBoardNumber === null) {
      return
    }

    setUsedCluesByBoard((previousState) => ({
      ...previousState,
      [activeBoardNumber]: [],
    }))
    setScores(createInitialScores())
    setTeamPlayerScores(createInitialTeamPlayerScores(teamAPlayerCount, teamBPlayerCount))
    setAnswerLog([])
    setSelectedResponderByTeam({
      teamA: 0,
      teamB: 0,
    })
    setActiveClue(null)
    setAnswerVisible(false)
  }

  const requestActiveBoardReset = () => {
    if (activeBoardNumber === null) {
      return
    }

    setIsResetPromptOpen(true)
  }

  const cancelActiveBoardReset = () => {
    setIsResetPromptOpen(false)
  }

  const confirmActiveBoardReset = () => {
    performActiveBoardReset()
    setIsResetPromptOpen(false)
  }

  const returnToBoardSelect = () => {
    setScreen('board-select')
    setActiveClue(null)
    setAnswerVisible(false)
    setIsResetPromptOpen(false)
    setAnswerLog([])
  }

  const openClue = (clue: Clue) => {
    if (activeBoardNumber === null) {
      return
    }

    const usedClues = usedCluesByBoard[activeBoardNumber] ?? []
    if (usedClues.includes(clue.id)) {
      return
    }

    setActiveClue(clue)
    setAnswerVisible(false)
  }

  const closeClueModal = () => {
    setActiveClue(null)
    setAnswerVisible(false)
  }

  const judgeClue = (isCorrect: boolean, teamKey?: TeamKey, responderIndex?: number) => {
    if (!activeClue || activeBoardNumber === null) {
      return
    }

    if (gameMode === 'versus' && !teamKey) {
      return
    }

    setUsedCluesByBoard((previousState) => {
      const nextUsedClues = new Set(previousState[activeBoardNumber] ?? [])
      nextUsedClues.add(activeClue.id)

      return {
        ...previousState,
        [activeBoardNumber]: Array.from(nextUsedClues),
      }
    })

    const scoreDelta = isCorrect ? activeClue.points : -activeClue.points
    const currentTeamKey = teamKey
    const playerIndex =
      currentTeamKey !== undefined
        ? responderIndex ?? selectedResponderByTeam[currentTeamKey]
        : 0

    setScores((previousScores) => {
      if (gameMode === 'single') {
        return {
          ...previousScores,
          single: previousScores.single + scoreDelta,
        }
      }

      if (!currentTeamKey) {
        return previousScores
      }

      return {
        ...previousScores,
        [currentTeamKey]: previousScores[currentTeamKey] + scoreDelta,
      }
    })

    if (gameMode === 'versus' && currentTeamKey) {
      setTeamPlayerScores((previousScores) => {
        const nextTeamScores = [...(previousScores[currentTeamKey] ?? [])]
        nextTeamScores[playerIndex] = (nextTeamScores[playerIndex] ?? 0) + scoreDelta

        return {
          ...previousScores,
          [currentTeamKey]: nextTeamScores,
        }
      })

      setAnswerLog((previousLog) => [
        {
          clueId: activeClue.id,
          clueLabel: `${activeClue.categoryLabel} ${activeClue.points}`,
          teamLabel: currentTeamKey === 'teamA' ? teamALabel : teamBLabel,
          playerLabel: getTeamPlayerLabel(currentTeamKey, playerIndex),
          pointsDelta: scoreDelta,
        },
        ...previousLog,
      ])
    }

    closeClueModal()
  }

  return (
    <div className="app-shell">
      <main className={`screen-frame screen-${screen}`}>
        {screen === 'landing' && (
          <section className="landing-layout">
            <div className="landing-copy">
              <p className="badge">Cre8Con Presents</p>
              <h1>Cre8Con JPEGDy</h1>
              <p className="subtitle">
                Cute, pastel, and chaotic in the best way. Test your crew across art,
                games, trends, JPEG lore, and Cre8Con trivia.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setScreen('board-select')}
              >
                Start Game
              </button>
            </div>
            <div className="landing-visual">
              <img src={heroArtwork} alt="JPEG core character artwork" />
            </div>
          </section>
        )}

        {screen === 'board-select' && (
          <section className="select-layout">
            <header className="select-header">
              <button className="btn btn-ghost" onClick={() => setScreen('landing')}>
                Back to Landing
              </button>
              <h2>Choose Your Board</h2>
              <p>Pick Board 1 or Board 2 to begin the round.</p>
            </header>

            <section className="mode-setup-card">
              <p className="mode-setup-eyebrow">Match Setup</p>
              <h3>Choose a scoring mode</h3>

              <div className="mode-toggle">
                <button
                  type="button"
                  className={`mode-chip${gameMode === 'single' ? ' is-active' : ''}`}
                  onClick={() => setGameMode('single')}
                >
                  Single Player
                </button>
                <button
                  type="button"
                  className={`mode-chip${gameMode === 'versus' ? ' is-active' : ''}`}
                  onClick={() => setGameMode('versus')}
                >
                  Team Versus
                </button>
              </div>

              {gameMode === 'single' && (
                <label className="setup-field">
                  <span>Player Name</span>
                  <input
                    value={singlePlayerName}
                    onChange={(event) => setSinglePlayerName(event.target.value)}
                    placeholder="Player 1"
                    maxLength={24}
                  />
                </label>
              )}

              {gameMode === 'versus' && (
                <>
                  <div className="versus-setup-grid">
                    <label className="setup-field">
                      <span>Team A Name</span>
                      <input
                        value={teamAName}
                        onChange={(event) => setTeamAName(event.target.value)}
                        placeholder="Team A"
                        maxLength={24}
                      />
                    </label>

                    <label className="setup-field">
                      <span>Team B Name</span>
                      <input
                        value={teamBName}
                        onChange={(event) => setTeamBName(event.target.value)}
                        placeholder="Team B"
                        maxLength={24}
                      />
                    </label>

                    <label className="setup-field">
                      <span>Team A Players</span>
                      <select
                        value={teamAPlayerCount}
                        onChange={(event) =>
                          updateTeamPlayerCount('teamA', Number(event.target.value))
                        }
                      >
                        {PLAYER_COUNT_OPTIONS.map((playerCount) => (
                          <option key={playerCount} value={playerCount}>
                            {playerCount}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="setup-field">
                      <span>Team B Players</span>
                      <select
                        value={teamBPlayerCount}
                        onChange={(event) =>
                          updateTeamPlayerCount('teamB', Number(event.target.value))
                        }
                      >
                        {PLAYER_COUNT_OPTIONS.map((playerCount) => (
                          <option key={playerCount} value={playerCount}>
                            {playerCount}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className={`setup-status ${isVersusConfigValid ? 'is-valid' : 'is-error'}`}>
                    {isVersusConfigValid
                      ? `Balanced teams ready: ${teamAPlayerCount} players per team.`
                      : 'Team Versus requires both teams to have the same number of players (1 to 5).'}
                  </p>

                  <div className="player-roster-grid">
                    <section className="player-roster-card">
                      <h4>{teamALabel} Roster</h4>
                      {Array.from({ length: teamAPlayerCount }, (_, playerIndex) => (
                        <label className="setup-field" key={`team-a-player-${playerIndex}`}>
                          <span>{teamALabel} Player {playerIndex + 1}</span>
                          <input
                            value={teamPlayerNames.teamA[playerIndex] ?? ''}
                            onChange={(event) =>
                              updateTeamPlayerName('teamA', playerIndex, event.target.value)
                            }
                            placeholder={`${teamALabel} Player ${playerIndex + 1}`}
                            maxLength={24}
                          />
                        </label>
                      ))}
                    </section>

                    <section className="player-roster-card">
                      <h4>{teamBLabel} Roster</h4>
                      {Array.from({ length: teamBPlayerCount }, (_, playerIndex) => (
                        <label className="setup-field" key={`team-b-player-${playerIndex}`}>
                          <span>{teamBLabel} Player {playerIndex + 1}</span>
                          <input
                            value={teamPlayerNames.teamB[playerIndex] ?? ''}
                            onChange={(event) =>
                              updateTeamPlayerName('teamB', playerIndex, event.target.value)
                            }
                            placeholder={`${teamBLabel} Player ${playerIndex + 1}`}
                            maxLength={24}
                          />
                        </label>
                      ))}
                    </section>
                  </div>
                </>
              )}
            </section>

            <div className="board-option-grid">
              {BOARDS.map((board) => (
                <button
                  key={board.boardNumber}
                  className="board-option"
                  disabled={!canChooseBoard}
                  onClick={() => openRulesModal(board.boardNumber)}
                >
                  <span className="board-option-eyebrow">Round Select</span>
                  <strong>Board {board.boardNumber}</strong>
                  <span>{board.categories.length} categories and 25 clues</span>
                </button>
              ))}
            </div>

            {gameMode === 'versus' && !isVersusConfigValid && (
              <p className="board-lock-note">
                Balance both teams first to unlock board selection.
              </p>
            )}
          </section>
        )}

        {screen === 'board' && activeBoard && (
          <section className="board-layout">
            <header className="board-header">
              <div className="board-actions">
                <button className="btn btn-ghost" onClick={returnToBoardSelect}>
                  Change Board
                </button>
                <button className="btn btn-ghost btn-reset" onClick={requestActiveBoardReset}>
                  Reset Board
                </button>
              </div>
              <div>
                <h2>Cre8Con Jeopardy</h2>
                <p>
                  Current Round: Board {activeBoard.boardNumber} •{' '}
                  {gameMode === 'single' ? 'Single Player' : 'Team Versus'}
                </p>
              </div>

              {gameMode === 'single' ? (
                <div className="score-panel">
                  <span>{singlePlayerLabel}</span>
                  <small>Single Player</small>
                  <strong>{scores.single}</strong>
                </div>
              ) : (
                <div className="score-cluster">
                  <div className="score-panel">
                    <span>{teamALabel}</span>
                    <small>{formatPlayerCount(teamAPlayerCount)}</small>
                    <strong>{scores.teamA}</strong>
                  </div>
                  <div className="score-panel">
                    <span>{teamBLabel}</span>
                    <small>{formatPlayerCount(teamBPlayerCount)}</small>
                    <strong>{scores.teamB}</strong>
                  </div>
                </div>
              )}
            </header>

            {gameMode === 'versus' && (
              <div className="board-insights-grid">
                <section className="player-scoreboard-card">
                  <h3>Player Scoreboard</h3>
                  <div className="player-scoreboard-grid">
                    <article className="player-scoreboard-team">
                      <div className="player-scoreboard-team-header">
                        <div>
                          <span>{teamALabel}</span>
                          <small>{formatPlayerCount(teamAPlayerCount)}</small>
                        </div>
                        <strong>{scores.teamA}</strong>
                      </div>
                      <div className="player-scoreboard-list">
                        {teamAPlayerLabels.map((playerLabel, playerIndex) => (
                          <div
                            key={`team-a-score-${playerIndex}`}
                            className={`player-score-row${selectedResponderByTeam.teamA === playerIndex ? ' is-active' : ''}`}
                          >
                            <span>{playerLabel}</span>
                            <strong>{teamPlayerScores.teamA[playerIndex] ?? 0}</strong>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="player-scoreboard-team">
                      <div className="player-scoreboard-team-header">
                        <div>
                          <span>{teamBLabel}</span>
                          <small>{formatPlayerCount(teamBPlayerCount)}</small>
                        </div>
                        <strong>{scores.teamB}</strong>
                      </div>
                      <div className="player-scoreboard-list">
                        {teamBPlayerLabels.map((playerLabel, playerIndex) => (
                          <div
                            key={`team-b-score-${playerIndex}`}
                            className={`player-score-row${selectedResponderByTeam.teamB === playerIndex ? ' is-active' : ''}`}
                          >
                            <span>{playerLabel}</span>
                            <strong>{teamPlayerScores.teamB[playerIndex] ?? 0}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </section>

                <section className="answer-log-card">
                  <h3>Clue Answer Tracker</h3>
                  {answerLog.length === 0 ? (
                    <p className="answer-log-empty">No clues judged yet.</p>
                  ) : (
                    <ul className="answer-log-list">
                      {answerLog.map((entry) => (
                        <li
                          key={entry.clueId}
                          className={`answer-log-item ${entry.pointsDelta >= 0 ? 'is-positive' : 'is-negative'}`}
                        >
                          <span>{entry.clueLabel}</span>
                          <span className="log-player">
                            {entry.teamLabel} • {entry.playerLabel}
                          </span>
                          <strong>
                            {entry.pointsDelta > 0 ? `+${entry.pointsDelta}` : entry.pointsDelta}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            <div className="category-grid">
              {activeBoard.categories.map((category) => (
                <section key={category.key} className={`category-column ${category.colorClass}`}>
                  <h3>{category.label}</h3>
                  <div className="clue-column">
                    {category.clues.map((clue) => {
                      const isUsed = activeUsedClues.includes(clue.id)
                      const isActive = activeClue?.id === clue.id

                      return (
                        <button
                          key={clue.id}
                          className={`clue-card${isActive ? ' is-active' : ''}`}
                          onClick={() => openClue(clue)}
                          disabled={isUsed}
                        >
                          {isUsed ? 'Done' : clue.points}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}
      </main>

      {boardIsComplete && activeBoard && (
        <div className="modal-backdrop">
          <div
            className="modal-card board-complete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-complete-title"
          >
            <p className="modal-label">Board {activeBoard.boardNumber} Complete</p>
            <h3 id="board-complete-title">Round Cleared</h3>

            {gameMode === 'single' ? (
              <>
                <p className="complete-score-copy">{singlePlayerLabel} Final Score</p>
                <p className="complete-score-value">{scores.single}</p>
              </>
            ) : (
              <div className="complete-score-grid">
                <div className="complete-team-score">
                  <span>{teamALabel}</span>
                  <strong>{scores.teamA}</strong>
                </div>
                <div className="complete-team-score">
                  <span>{teamBLabel}</span>
                  <strong>{scores.teamB}</strong>
                </div>
              </div>
            )}

            <p className="complete-message">
              All {totalClueCount} clues have been played. Reset the board to play this
              round again or choose another board.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={returnToBoardSelect}>
                Back to Board Select
              </button>
              <button className="btn btn-primary" onClick={requestActiveBoardReset}>
                Reset This Board
              </button>
            </div>
          </div>
        </div>
      )}

      {rulesBoardNumber !== null && (
        <div className="modal-backdrop" role="presentation" onClick={closeRulesModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="modal-label">Board {rulesBoardNumber}</p>
            <h3 id="rules-title">Game Mechanics</h3>
            <ul className="rules-list">
              <li>Select any clue card on the board to open the question view.</li>
              <li>Click Show Answer so the host can reveal the solution.</li>
              <li>Host marks Correct or Incorrect to update the live score.</li>
              <li>In Team Versus mode, select the responding player before judging.</li>
              <li>
                {gameMode === 'single'
                  ? `${singlePlayerLabel} is the active player for this round.`
                  : `${teamALabel} and ${teamBLabel} are locked at ${formatPlayerCount(teamAPlayerCount)} each.`}
              </li>
              <li>Each clue can only be played once per board.</li>
            </ul>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeRulesModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={proceedToBoard}>
                Proceed to Board
              </button>
            </div>
          </div>
        </div>
      )}

      {activeClue && (
        <div className="modal-backdrop" role="presentation" onClick={closeClueModal}>
          <div
            className="modal-card question-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clue-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="modal-label">
              {activeClue.categoryLabel} • {activeClue.points} points
            </p>
            <h3 id="clue-title" className="clue-question-text">
              {activeClue.question}
            </h3>

            {!answerVisible && (
              <button className="btn btn-primary" onClick={() => setAnswerVisible(true)}>
                Show Answer
              </button>
            )}

            {answerVisible && (
              <>
                <div className="answer-block">
                  <span>Answer</span>
                  <p>{activeClue.answer}</p>
                </div>

                {gameMode === 'single' ? (
                  <div className="modal-actions">
                    <button className="btn btn-correct" onClick={() => judgeClue(true)}>
                      Correct
                    </button>
                    <button className="btn btn-incorrect" onClick={() => judgeClue(false)}>
                      Incorrect
                    </button>
                  </div>
                ) : (
                  <div className="versus-judge-grid">
                    <section className="team-judge-card">
                      <label className="judge-player-select">
                        <span>{teamALabel} Responding Player</span>
                        <select
                          value={selectedResponderByTeam.teamA}
                          onChange={(event) =>
                            setSelectedResponderByTeam((previousSelection) => ({
                              ...previousSelection,
                              teamA: Number(event.target.value),
                            }))
                          }
                        >
                          {teamAPlayerLabels.map((playerLabel, playerIndex) => (
                            <option key={`team-a-select-${playerIndex}`} value={playerIndex}>
                              {playerLabel}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="team-judge-actions">
                        <button
                          className="btn btn-correct"
                          onClick={() =>
                            judgeClue(
                              true,
                              'teamA',
                              selectedResponderByTeam.teamA,
                            )
                          }
                        >
                          {teamALabel} Correct
                        </button>
                        <button
                          className="btn btn-incorrect"
                          onClick={() =>
                            judgeClue(
                              false,
                              'teamA',
                              selectedResponderByTeam.teamA,
                            )
                          }
                        >
                          {teamALabel} Incorrect
                        </button>
                      </div>
                    </section>

                    <section className="team-judge-card">
                      <label className="judge-player-select">
                        <span>{teamBLabel} Responding Player</span>
                        <select
                          value={selectedResponderByTeam.teamB}
                          onChange={(event) =>
                            setSelectedResponderByTeam((previousSelection) => ({
                              ...previousSelection,
                              teamB: Number(event.target.value),
                            }))
                          }
                        >
                          {teamBPlayerLabels.map((playerLabel, playerIndex) => (
                            <option key={`team-b-select-${playerIndex}`} value={playerIndex}>
                              {playerLabel}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="team-judge-actions">
                        <button
                          className="btn btn-correct"
                          onClick={() =>
                            judgeClue(
                              true,
                              'teamB',
                              selectedResponderByTeam.teamB,
                            )
                          }
                        >
                          {teamBLabel} Correct
                        </button>
                        <button
                          className="btn btn-incorrect"
                          onClick={() =>
                            judgeClue(
                              false,
                              'teamB',
                              selectedResponderByTeam.teamB,
                            )
                          }
                        >
                          {teamBLabel} Incorrect
                        </button>
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}

            <button className="link-button" onClick={closeClueModal}>
              Close
            </button>
          </div>
        </div>
      )}

      {isResetPromptOpen && (
        <div className="modal-backdrop" role="presentation" onClick={cancelActiveBoardReset}>
          <div
            className="modal-card reset-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="modal-label">Confirm Reset</p>
            <h3 id="reset-confirm-title">Reset board progress and clear scores?</h3>
            <p className="complete-message">
              This will reset all clues in the current board and bring every score back to zero.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={cancelActiveBoardReset}>
                Cancel
              </button>
              <button className="btn btn-primary btn-reset-confirm" onClick={confirmActiveBoardReset}>
                Yes, Reset Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
