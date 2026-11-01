---
title: "Alternating Current: Important Points and Traps"
type: key_points
chapter: c12.physics.alternating-current
order: 3
---

## Peak, rms and average

:::trap
A stated ac value ("220 V", "5 A") is the **rms** value. The peak is $\sqrt2$ times bigger: 220 V rms means a peak of about 311 V. Use rms values in $P = VI\cos\phi$; if you use peak values, divide by 2.
:::

- The average of a sinusoidal current over a **full cycle is zero**, but its rms value is not. Heating depends on $i^2$, not on $i$.
- $I = i_m/\sqrt2$ is only for a **sine** (or cosine) wave. For any other shape, find $\sqrt{\langle i^2\rangle}$ (NCERT's definition; using it for other shapes is an exam extra).
- (Beyond the syllabus, not in NCERT) Average over **half** a cycle $= 2i_m/\pi \approx 0.637\,i_m$. The order is: peak > rms > half-cycle average.

:::trap
In $v = v_m\sin\omega t$, $\omega$ is the **angular** frequency. For $v = 311\sin(100\pi t)$: $\omega = 100\pi$ rad/s, $\nu = 50$ Hz, $V_{rms} \approx 220$ V.
:::

- In one cycle the current becomes zero **twice** and reaches its peak value (in either direction) **twice**. Mains at 50 Hz changes direction 100 times a second.
- Time from zero to peak $= T/4$. Time from zero to the rms value $= T/8$ (since $\sin 45^\circ = 1/\sqrt2$).

## L and C

:::tip
**CIVIL:** in a **C**apacitor, **I** comes before **V**; in an inductor (**L**), **V** comes before **I**. So current leads in C and lags in L, each by $90^\circ$.
:::

:::remember
- $X_L = \omega L$ grows with frequency. An inductor passes dc freely ($X_L = 0$) and opposes high frequencies.
- $X_C = 1/\omega C$ falls with frequency. A capacitor blocks steady dc ($X_C \to \infty$) and passes high frequencies easily.
- Double the frequency: $X_L$ doubles, $X_C$ halves.
:::

:::trap
"Average power in a pure L or C is zero" is about the **average over a cycle**. The instantaneous power is not zero: it is positive for a quarter cycle (energy stored) and negative for the next (energy given back).
:::

- Putting a soft-iron rod into a coil raises $L$, so $X_L$ rises. A bulb in series with that coil on ac gets **dimmer** (NCERT Example 7.5).
- A reactance limits current like a resistance does, but uses no power.

## Series LCR

:::trap
**Never add voltages as plain numbers.** In series LCR:
$$V = \sqrt{V_R^2 + (V_L - V_C)^2}$$
$V_R + V_L + V_C$ is usually more than the source voltage. That is not a paradox; the voltages are out of phase.
:::

:::trap
**Sign of $\phi$.** NCERT writes $i = i_m\sin(\omega t + \phi)$ with $\tan\phi = (X_C - X_L)/R$, so a negative $\phi$ means the current lags (inductive). Other books write $\tan\phi = (X_L - X_C)/R$ for how much the voltage leads. The size of the angle is the same; read the question's convention before you answer "leads" or "lags".
:::

- $X_L > X_C$ → inductive → current lags. $X_C > X_L$ → capacitive → current leads.
- Below $\omega_0$ a series LCR circuit is **capacitive**; above $\omega_0$ it is **inductive**. (At low frequency $X_C$ is large; at high frequency $X_L$ is large.)
- $Z \ge R$ always. With both L and C present, $Z = R$ only at resonance.

## Resonance

:::remember
At resonance ($\omega_0 = 1/\sqrt{LC}$):
- $X_L = X_C$, $Z = R$ (least), current is the largest;
- $\phi = 0$, power factor = 1, power $= V^2/R$ is the largest;
- $V_L$ and $V_C$ cancel, so the whole source voltage is across R.
:::

:::trap
At resonance $V_L$ and $V_C$ cancel **each other**, but each one can be **much larger than the source voltage** ($V_L = V_C = QV$, exam extra). The voltage across the L and C together is zero (NCERT Exercise 7.8).
:::

- Resonance is impossible in an RL or RC circuit. It needs both L and C.
- $\omega_0$ does not depend on $R$. $R$ only decides how tall the peak is: smaller $R$, taller peak (and sharper, exam extra).
- Watch the units: $\omega_0 = 1/\sqrt{LC}$ is in rad/s; $\nu_0 = \omega_0/2\pi$ is in Hz.

## Power factor

- $P = VI\cos\phi$, with rms $V$ and $I$. The product $VI$ alone (the "apparent power", exam extra, not in NCERT) is in volt-ampere, not watt.
- Power is used **only in R**. In any series circuit, $P = I^2R$ is the safest formula.
- **Wattless current:** current that flows but uses no average power. In a pure L or C circuit, all of it is wattless.

:::trap
To improve a lagging (inductive) power factor, add a **capacitor in parallel**, not a resistor. A resistor would raise $\cos\phi$ but waste power.
:::

## Transformer

:::trap
A transformer does **not** work on steady dc. Constant current gives constant flux, so no emf is induced in the secondary.
:::

:::trap
A step-up transformer raises the voltage but **lowers the current** in the same ratio. Power out cannot be more than power in; energy is conserved.
:::

- The **frequency is the same** on both sides.
- $V_s/V_p = N_s/N_p$ holds for an ideal transformer. $I_s/I_p = N_p/N_s$ needs no loss as well. With efficiency $\eta$: $V_sI_s = \eta V_pI_p$.
- **Laminated core** cuts eddy currents. **Low-hysteresis** material cuts hysteresis loss. Winding the coils **one over the other** cuts flux leakage. **Thick wire** cuts $I^2R$ loss in high-current coils.
- Power is sent at **high voltage, low current** to cut the $I^2R$ loss. For the same power, raising $V$ by 10 times cuts the line loss by 100 times.

## NCERT lines to know

:::remember
- The power rating of an ac device is its **average** power rating.
- The average power used in an ac circuit is never negative.
- There is no power loss in pure capacitors and pure inductors; only the resistive element uses energy.
- Phasors represent voltage and current, but these quantities are scalars, not vectors.
- The power factor tells how close the circuit is to using the maximum power.
:::
