import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDrafts, saveDraft } from '@/lib/supabase/exercise-drafts';
import type { TrainingHistoryEntry } from '@/lib/supabase/training-history';
import { completeDay } from '@/lib/supabase/workout';

export interface WorkoutLogExercise {
  programExerciseId: string;
  name: string;
  /** Only rendered in `viewDensity` 1 (image view). */
  imageUrl?: string | null;
}

type ViewDensity = 1 | 2 | 3;

interface WorkoutLogFormProps {
  userId: string;
  dayId: string;
  /** e.g. "Day 1" — rendered alongside the date input, matching web's
   * paired day-label/date-input header row. */
  dayLabel: string;
  /** Mirrors web's `ProgramTabs` I/II/III — a display-only density switch
   * (cosmetic, no data implication): 1 = thumbnail + name, 2 = single
   * truncated line (default), 3 = wrapping paragraph, no truncation. */
  viewDensity: ViewDensity;
  exercises: WorkoutLogExercise[];
  /** This day's full history, most-recent-first (already sorted by
   * `getTrainingHistoryForProgram`) — every past entry, not just the
   * latest, matching web's own horizontally-scrollable multi-date
   * `TrainingHistory` column. */
  history: TrainingHistoryEntry[];
  /** Invoked once, after completeDay succeeds — lets the caller refresh history. */
  onComplete?: () => void;
}

// Matches web's TrainingHistory date formatting ('uk-UA', 2-digit
// day/month/year) — compact enough to fit a narrow history column.
function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

// Fixed per-row height, varying by density — keeps the name column, the
// scrollable history column, and the input column visually aligned row for
// row despite being three independent sibling stacks (mirroring web's own
// three-column layout, which relies on the same fixed-height-per-row trick
// in CSS). Density 1's thumbnail and density 2's single truncated line both
// have a content-independent height; density 3's wrapping name text doesn't
// (see `nameLineHeight` below).
function rowHeight(viewDensity: ViewDensity): number {
  if (viewDensity === 1) return 52;
  return 32;
}

const NAME_LINE_HEIGHT = 20; // matches ThemedText type="small"'s lineHeight
const NAME_CELL_VERTICAL_PADDING = 16;
const DENSITY_3_MIN_ROW_HEIGHT = 56;

// Density 3 renders the name with no `numberOfLines` cap ("wrapping
// paragraph, no truncation"), so unlike density 1/2 its row height can't be
// a constant — a 3+-line name would overflow a fixed cell and desync every
// row after it from the history/input columns beside it (RN has no way to
// share a single CSS height rule across three sibling trees the way web
// does). `nameLineCounts` is filled in via each name Text's `onTextLayout`
// once actual wrapping is known, and this derives the row height from it.
function density3RowHeight(lineCount: number): number {
  return Math.max(
    DENSITY_3_MIN_ROW_HEIGHT,
    lineCount * NAME_LINE_HEIGHT + NAME_CELL_VERTICAL_PADDING,
  );
}

const HEADER_ROW_HEIGHT = 32;
const HISTORY_COL_WIDTH = 90;
// Fixed height for every date/value `TextInput`, independent of density —
// the surrounding cell still grows for density 1's thumbnail or density
// 3's wrapped name, but the input itself always stays this size, centered
// in the taller cell via `cell`'s own `justifyContent: 'center'`, rather
// than stretching to fill it.
const INPUT_HEIGHT = 32;
// Breathing room to the right of an expanded density-2 name — web's
// `li:has(span):hover span` uses `padding: 2px 15px 2px 0`.
const NAME_EXPANDED_PADDING_RIGHT = Spacing.three;

type DraftsState = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

type CompleteState =
  | { state: 'idle' }
  | { state: 'completing' }
  | { state: 'done' }
  | { state: 'error'; message: string };

/**
 * Per-day workout logging: date + free-text value per exercise, autosaved
 * as a draft on blur, with a Complete action that writes exercise_logs +
 * training_history and clears the drafts. Mirrors web's TrainingProcessing
 * (`app/training/program/[id]/components/trainingProcessing/trainingProcessing.tsx`)
 * for the write flow.
 *
 * Layout mirrors web's actual three-column structure now (not the earlier,
 * simpler single-row-per-exercise version): a fixed name column, a
 * horizontally-scrollable history column (one sub-column per past date,
 * `ScrollView horizontal` wrapping a small vertical stack — date header row
 * on top, one value row per exercise below, all scrolling together since
 * they share the same `ScrollView`), and a fixed input column. Web achieves
 * the same alignment with three separately-scrolling, height-synced DOM
 * lists; RN can't share a single CSS height rule across three sibling
 * trees, so each row instead gets an explicit `height` applied consistently
 * across all three columns — a density-dependent constant (`rowHeight()`)
 * for densities 1/2, or a per-row, content-derived one
 * (`density3RowHeight()`) for density 3's unbounded wrapping text.
 *
 * Plain component state rather than react-hook-form: unlike the auth forms,
 * there's no validation schema here — just a dynamically-keyed set of
 * free-text fields with per-field async autosave, which RHF doesn't buy
 * anything for.
 */
export function WorkoutLogForm({
  userId,
  dayId,
  dayLabel,
  viewDensity,
  exercises,
  history,
  onComplete,
}: WorkoutLogFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState('');
  const [draftsState, setDraftsState] = useState<DraftsState>({ state: 'loading' });
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [completeState, setCompleteState] = useState<CompleteState>({ state: 'idle' });
  // Density-3-only, keyed by programExerciseId — see `density3RowHeight`.
  const [nameLineCounts, setNameLineCounts] = useState<Record<string, number>>({});
  // Density-2-only. Mirrors web's `li:has(span):hover` — mobile browsers
  // apply `:hover` on tap and hold it until something else is tapped, which
  // web relies on to reveal a truncated exercise's full name; RN has no
  // such thing, so it's explicit tap-to-expand state instead. Only one
  // name at a time, matching web's own single-`:hover`-target behavior.
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  // Density-2-only, keyed by programExerciseId. RN's Yoga gives an
  // absolutely-positioned node's width from its *containing block* (the
  // nearest positioned ancestor), not from its own unconstrained content —
  // unlike CSS `position: relative` + `overflow: unset`, there's no way to
  // tell it "just size to your text." So the expanded overlay's width is
  // measured out-of-band instead: an invisible, off-screen, unconstrained
  // copy of the same text reports its natural width via `onLayout`, and
  // that measured pixel value is applied to the overlay directly.
  const [nameWidths, setNameWidths] = useState<Record<string, number>>({});
  // Density-2-only, keyed by programExerciseId — each row's own Y offset
  // within `day`, from `onLayout` on its name cell. The expanded overlay
  // can't live inside the name column and rely on `zIndex` to rise above
  // the history/input columns beside it: RN's `zIndex` only orders
  // siblings under the *same* parent, and the name column, history column,
  // and input column are siblings of *each other*, several levels above
  // where the overlay would sit if nested in the name column — so the
  // history column (a later sibling, painted after) covers it regardless
  // of `zIndex`, confirmed by seeing it peek through only in the gap
  // between the history and input columns. Rendering the overlay instead
  // as a sibling of the name/history/input columns themselves, last in
  // JSX (painted last, on top of all three), fixes it — but that means it
  // needs its own Y position, since it's no longer a descendant of the
  // row it's expanding.
  const [nameRowTops, setNameRowTops] = useState<Record<string, number>>({});

  // Mirrors `values`, mutated synchronously alongside every state update.
  // `TextInput`'s onBlur event in this React Native version carries no
  // text payload (confirmed against the installed types — it's typed as
  // `BlurEvent`, not `TextInputFocusEvent`), and reading from `values`
  // state directly in a blur handler isn't safe either: onChangeText's
  // state update and the blur event can land in the same batch, so a
  // closure over `values` isn't guaranteed to have caught the very last
  // keystroke yet. A ref sidesteps both — it's always current the instant
  // it's written, independent of React's render/commit timing.
  const valuesRef = useRef<Record<string, string>>({});

  const applyValues = (next: Record<string, string>) => {
    valuesRef.current = next;
    setValues(next);
  };

  // `exercises` is rebuilt as a fresh array by the caller on every render of
  // its own parent — depending on it by reference would refetch (and
  // overwrite any in-progress unsaved keystroke) on unrelated re-renders
  // elsewhere on the screen. This derived id list only changes value when
  // the actual set of exercises does.
  const programExerciseIds = exercises.map((exercise) => exercise.programExerciseId);
  const programExerciseIdsKey = programExerciseIds.join(',');

  useEffect(() => {
    let isMounted = true;

    getDrafts(userId, programExerciseIds)
      .then((drafts) => {
        if (!isMounted) return;
        applyValues(drafts);
        setDraftsState({ state: 'ready' });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setDraftsState({ state: 'error', message: (error as Error).message });
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- programExerciseIdsKey is the intentional, stable proxy for programExerciseIds
  }, [userId, dayId, programExerciseIdsKey]);

  const handleChangeText = (programExerciseId: string, text: string) => {
    valuesRef.current = { ...valuesRef.current, [programExerciseId]: text };
    setValues(valuesRef.current);
  };

  const handleBlur = (programExerciseId: string) => {
    const value = valuesRef.current[programExerciseId] ?? '';
    saveDraft(userId, programExerciseId, dayId, value)
      .then(() => setDraftSaveError(null))
      .catch((error: unknown) => setDraftSaveError((error as Error).message));
  };

  const handleComplete = () => {
    if (!date) return;

    setCompleteState({ state: 'completing' });
    completeDay(userId, dayId, date, valuesRef.current)
      .then(() => {
        applyValues({});
        setCompleteState({ state: 'done' });
        onComplete?.();
      })
      .catch((error: unknown) => {
        setCompleteState({ state: 'error', message: (error as Error).message });
      });
  };

  if (draftsState.state === 'loading') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {t('components.workoutLogForm.loadingLog')}
      </ThemedText>
    );
  }

  if (draftsState.state === 'error') {
    return (
      <ThemedText type="small" themeColor="danger">
        ❌ {draftsState.message}
      </ThemedText>
    );
  }

  const isComplete = completeState.state === 'done';
  const isCompleting = completeState.state === 'completing';
  const defaultRowHeight = rowHeight(viewDensity);
  const rowHeightFor = (programExerciseId: string): number =>
    viewDensity === 3
      ? density3RowHeight(nameLineCounts[programExerciseId] ?? 1)
      : defaultRowHeight;
  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: 'transparent', borderColor: theme.border },
  ];

  return (
    <ThemedView style={styles.container}>
      {/* `Pressable`, not `ThemedView` — a tap anywhere in this row that
          isn't captured by a nested `Pressable`/`TextInput` first (RN's
          responder system already resolves that, no manual propagation
          logic needed) collapses an expanded density-2 name, mirroring
          web's own "click elsewhere reverts" `:hover` behavior. */}
      <Pressable
        onPress={() => setExpandedExerciseId(null)}
        style={[styles.day, { backgroundColor: 'transparent' }]}
      >
        {/* Fixed name column */}
        <ThemedView style={[styles.nameColumn, { backgroundColor: 'transparent' }]}>
          <ThemedView style={[styles.cell, { height: HEADER_ROW_HEIGHT }]}>
            <ThemedText type="smallBold">{dayLabel}</ThemedText>
          </ThemedView>
          {exercises.map((exercise, index) => (
            <ThemedView
              key={exercise.programExerciseId}
              style={[
                styles.cell,
                styles.nameCellRow,
                { height: rowHeightFor(exercise.programExerciseId) },
              ]}
              onLayout={
                viewDensity === 2
                  ? (event) => {
                      const top = event.nativeEvent.layout.y;
                      setNameRowTops((prev) =>
                        prev[exercise.programExerciseId] === top
                          ? prev
                          : { ...prev, [exercise.programExerciseId]: top },
                      );
                    }
                  : undefined
              }
            >
              {viewDensity === 1 ? (
                <>
                  <ThemedText type="small">{index + 1}.</ThemedText>
                  {exercise.imageUrl && (
                    <Image
                      source={{ uri: exercise.imageUrl }}
                      style={styles.thumbnail}
                      contentFit="cover"
                    />
                  )}
                </>
              ) : viewDensity === 2 ? (
                <Pressable
                  onPress={() =>
                    setExpandedExerciseId((prev) =>
                      prev === exercise.programExerciseId ? null : exercise.programExerciseId,
                    )
                  }
                  style={styles.nameTruncatedWrap}
                >
                  <ThemedText type="small" numberOfLines={1} style={styles.nameText}>
                    {index + 1}. {exercise.name}
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText
                  type="small"
                  style={styles.nameText}
                  onTextLayout={(event) => {
                    const lines = event.nativeEvent.lines.length;
                    setNameLineCounts((prev) =>
                      prev[exercise.programExerciseId] === lines
                        ? prev
                        : { ...prev, [exercise.programExerciseId]: lines },
                    );
                  }}
                >
                  {index + 1}. {exercise.name}
                </ThemedText>
              )}
            </ThemedView>
          ))}
        </ThemedView>

        {/* Horizontally-scrollable history column — one sub-column per past
            date, the date header and every exercise's value row scrolling
            together since they share this one ScrollView. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyColumn}>
          <ThemedView style={{ backgroundColor: 'transparent' }}>
            <ThemedView style={[styles.historyRow, { height: HEADER_ROW_HEIGHT }]}>
              {history.map((entry) => (
                <ThemedText
                  key={entry.id}
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  style={styles.historyCell}
                >
                  {formatShortDate(entry.date)}
                </ThemedText>
              ))}
            </ThemedView>
            {exercises.map((exercise) => (
              <ThemedView
                key={exercise.programExerciseId}
                style={[styles.historyRow, { height: rowHeightFor(exercise.programExerciseId) }]}
              >
                {history.map((entry) => (
                  <ThemedText
                    key={entry.id}
                    type="small"
                    numberOfLines={1}
                    style={styles.historyCell}
                  >
                    {entry.values[exercise.programExerciseId] ?? ''}
                  </ThemedText>
                ))}
              </ThemedView>
            ))}
          </ThemedView>
        </ScrollView>

        {/* Fixed input column */}
        <ThemedView style={[styles.inputColumn, { backgroundColor: 'transparent' }]}>
          <ThemedView style={[styles.cell, { height: HEADER_ROW_HEIGHT }]}>
            <TextInput
              style={inputStyle}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
              value={date}
              onChangeText={setDate}
              editable={!isComplete}
            />
          </ThemedView>
          {exercises.map((exercise) => (
            <ThemedView
              key={exercise.programExerciseId}
              style={[styles.cell, { height: rowHeightFor(exercise.programExerciseId) }]}
            >
              <TextInput
                style={inputStyle}
                placeholder="XXX/YYxZ"
                placeholderTextColor={theme.textSecondary}
                value={values[exercise.programExerciseId] ?? ''}
                onChangeText={(text) => handleChangeText(exercise.programExerciseId, text)}
                onBlur={() => handleBlur(exercise.programExerciseId)}
                editable={!isComplete}
              />
            </ThemedView>
          ))}
        </ThemedView>

        {/* Expanded density-2 name — a sibling of the name/history/input
            columns above, last in JSX so it paints on top of all three
            (see `nameRowTops`'s comment for why it can't live nested
            inside the name column instead). Positioned using `nameRowTops`
            (this row's own Y, measured via `onLayout`) and `nameWidths`
            (this exercise's natural text width, measured off-flow). */}
        {viewDensity === 2 &&
          expandedExerciseId &&
          (() => {
            const expandedIndex = exercises.findIndex(
              (exercise) => exercise.programExerciseId === expandedExerciseId,
            );
            const expandedExercise = exercises[expandedIndex];
            if (!expandedExercise) return null;

            return (
              <ThemedText
                type="small"
                numberOfLines={1}
                style={[
                  styles.nameExpanded,
                  {
                    top: (nameRowTops[expandedExerciseId] ?? 0) - 2,
                    backgroundColor: theme.workspace,
                    // RN's `width` is a border-box size (padding is
                    // subtracted from it for content), unlike this
                    // overlay's measurer (zero padding) — the measured
                    // width alone would clip the text against its own
                    // `paddingRight`.
                    width:
                      nameWidths[expandedExerciseId] !== undefined
                        ? nameWidths[expandedExerciseId] + NAME_EXPANDED_PADDING_RIGHT
                        : undefined,
                  },
                ]}
              >
                {expandedIndex + 1}. {expandedExercise.name}
              </ThemedText>
            );
          })()}
      </Pressable>

      {/* Off-flow measurement batch (density 2 only) — see `nameWidths`. A
          sibling of the name column's own narrow flex row rather than
          nested inside it: an absolutely-positioned child's available
          layout width still comes from its nearest *flex-constrained*
          ancestor (the row's own resolved pixel width), regardless of
          `left`/`top` — nesting the measurer there just reproduced the
          same truncation on a supposedly-unconstrained node. `container`
          itself carries no such width constraint, so text laid out here
          gets its true, unclipped intrinsic width. */}
      {viewDensity === 2 && (
        <ThemedView style={styles.nameMeasureLayer} pointerEvents="none">
          {exercises.map((exercise, index) => (
            <ThemedText
              key={exercise.programExerciseId}
              type="small"
              numberOfLines={1}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                setNameWidths((prev) =>
                  prev[exercise.programExerciseId] === width
                    ? prev
                    : { ...prev, [exercise.programExerciseId]: width },
                );
              }}
            >
              {index + 1}. {exercise.name}
            </ThemedText>
          ))}
        </ThemedView>
      )}

      {draftSaveError && (
        <ThemedText type="small" themeColor="danger">
          ❌ {draftSaveError}
        </ThemedText>
      )}

      <Button
        onPress={handleComplete}
        disabled={!date || isCompleting || isComplete}
        style={[styles.completeButton, { borderColor: theme.border }]}
      >
        <ThemedText type="smallBold">
          {isComplete
            ? t('components.workoutLogForm.completed')
            : isCompleting
              ? t('components.workoutLogForm.completing')
              : t('components.workoutLogForm.complete')}
        </ThemedText>
      </Button>

      {completeState.state === 'error' && (
        <ThemedText type="small" themeColor="danger">
          ❌ {completeState.message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  day: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    // Android's native `ViewGroup` clips children to its own bounds by
    // default — unlike iOS, just being `overflow: 'visible'` in RN's own
    // (CSS-matching) default isn't enough to actually disable that; it has
    // to be set explicitly here to reach the native clipChildren flag, or
    // the expanded name overlay below gets clipped to its row's original
    // narrow bounds no matter what width/position it's given. Same reason
    // on every ancestor down to the overlay itself.
    overflow: 'visible',
  },
  cell: {
    justifyContent: 'center',
    overflow: 'visible',
  },
  nameColumn: {
    flex: 0.34,
    overflow: 'visible',
  },
  nameCellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    overflow: 'visible',
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: Spacing.half,
  },
  nameText: {
    flexShrink: 1,
  },
  nameTruncatedWrap: {
    flexShrink: 1,
    position: 'relative',
    overflow: 'visible',
  },
  // See the comment at its call site — rendered off-screen at all times
  // (density 2 only), purely so its children can each report their own
  // natural, unclipped width via `onLayout` (`nameWidths`).
  nameMeasureLayer: {
    position: 'absolute',
    left: -9999,
    top: 0,
    opacity: 0,
  },
  // Web's `li:has(span):hover span`: unclipped, `nowrap`, a background
  // matching the page itself (`--button-bg` measures identical to
  // `theme.workspace`, not a distinct color — the shadow alone gives it
  // depth) plus a small shadow, `z-index` above the row it overlaps.
  // `position: 'absolute'` plus an explicit measured `width` (see
  // `nameWidths`) does the RN equivalent of unclipping: Yoga sizes an
  // absolutely-positioned node from its containing block, not its own
  // content, so intrinsic sizing alone isn't enough — sized this way, it
  // visually spills rightward over whatever is next to it without shifting
  // any row's layout.
  nameExpanded: {
    position: 'absolute',
    top: -2,
    left: 0,
    zIndex: 10,
    elevation: 4,
    borderRadius: 2,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
  },
  historyColumn: {
    flex: 1,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  historyCell: {
    width: HISTORY_COL_WIDTH,
  },
  inputColumn: {
    width: 104,
  },
  // Web's own `.process input`: 1px border, transparent fill, small
  // (browser-default) radius — not this app's usual bordered-input weight
  // (2px). Matched here deliberately since this screen is a direct visual
  // port, not the general form-field convention used elsewhere (auth
  // fields, search bar).
  input: {
    width: '100%',
    height: INPUT_HEIGHT,
    borderWidth: 1,
    borderRadius: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: 0,
    fontSize: 12,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  // Same reasoning as `input` — a thin, small-radius border instead of the
  // shared `Button` component's usual heavier 2px style, plus pinned to
  // the input column's width and the row's right edge rather than a
  // full-width block below every row.
  completeButton: {
    alignSelf: 'flex-end',
    minWidth: 90,
    minHeight: 30,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.half,
  },
});
