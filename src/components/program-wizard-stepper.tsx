import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ProgramWizardStepperProps {
  /** 1-indexed, matching create.tsx's own `step` state. */
  activeStep: number;
}

const STEP_COUNT = 5;
const CIRCLE_SIZE = 28;

// Web's Stepper (MUI, `app/training/create/components/stepper.tsx`) has no
// custom theme applied anywhere in that repo (confirmed: no createTheme/
// palette override exists) -- this is MUI's own stock default blue, copied
// verbatim rather than mapped to one of this app's semantic tokens, since
// it isn't actually one of this app's colors.
const STEP_ACCENT = '#1976d2';

export function ProgramWizardStepper({ activeStep }: ProgramWizardStepperProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const labels = [
    t('programs.create.stepper.name'),
    t('programs.create.stepper.type'),
    t('programs.create.stepper.difficulty'),
    t('programs.create.stepper.days'),
    t('programs.create.stepper.exercises'),
  ];

  return (
    <View style={styles.row}>
      {labels.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < activeStep;
        const isActive = stepNumber === activeStep;
        const isFilled = isCompleted || isActive;

        // A line segment on either side of the circle (rather than one line
        // trailing each circle) is what keeps the circle centered above its
        // own label -- the left segment of step N and the right segment of
        // step N-1 sit in different flex cells but touch at the shared
        // edge, reading as one continuous connector. Left reflects "have we
        // reached this step" (same condition as the circle's own fill),
        // right reflects "is this step already completed" -- matching how
        // the two connectors meeting at a completed circle both end up
        // colored, while the ones meeting at the active circle don't yet.
        const isFirst = index === 0;
        const isLast = stepNumber === STEP_COUNT;
        const leftColor = isFirst
          ? 'transparent'
          : isFilled
            ? STEP_ACCENT
            : theme.backgroundElement;
        const rightColor = isLast
          ? 'transparent'
          : isCompleted
            ? STEP_ACCENT
            : theme.backgroundElement;

        return (
          <View key={label} style={styles.step}>
            <View style={styles.circleRow}>
              <View style={[styles.connector, { backgroundColor: leftColor }]} />
              <View
                style={[
                  styles.circle,
                  { backgroundColor: isFilled ? STEP_ACCENT : theme.backgroundElement },
                ]}
              >
                {isCompleted ? (
                  <Check size={16} color="#fff" />
                ) : (
                  <ThemedText type="small" style={{ color: isActive ? '#fff' : theme.text }}>
                    {stepNumber}
                  </ThemedText>
                )}
              </View>
              <View style={[styles.connector, { backgroundColor: rightColor }]} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    height: 2,
  },
  label: {
    marginTop: Spacing.one,
    fontSize: 11,
    textAlign: 'center',
  },
});
