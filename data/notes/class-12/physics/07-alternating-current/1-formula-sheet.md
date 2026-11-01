---
title: "Alternating Current: Formula Sheet"
type: formula_sheet
chapter: c12.physics.alternating-current
order: 1
---

Convention (NCERT): the source voltage is $v = v_m\sin\omega t$, and the current is $i = i_m\sin(\omega t + \phi)$. So $\phi$ is the phase of the **current** compared with the source voltage. Lower-case $v_m$, $i_m$ are peak values; capital $V$, $I$ are rms values.

## AC voltage and rms values

:::formula{title="AC voltage"}
$$v = v_m\sin\omega t$$
$$\omega = 2\pi\nu = \frac{2\pi}{T}$$
$v_m$ = peak voltage (amplitude, V), $\omega$ = angular frequency (rad/s), $\nu$ = frequency (Hz), $T$ = time period (s). Indian mains: $\nu = 50$ Hz.
:::

:::formula{title="rms (effective) current and voltage"}
$$I = \frac{i_m}{\sqrt2} = 0.707\,i_m$$
$$V = \frac{v_m}{\sqrt2} = 0.707\,v_m$$
Only for a **sinusoidal** ac. $I$ is the steady dc current that gives the same average heating in a resistor. A stated ac value (220 V, 5 A) is an rms value unless the question says "peak". Over a full cycle $\langle\sin^2\omega t\rangle = \tfrac12$ but $\langle\sin\omega t\rangle = 0$: the average current is zero, the average of $i^2$ is not.
:::

## Pure resistor, inductor, capacitor

:::formula{title="Resistor"}
$$i_m = \frac{v_m}{R}$$
$$V = IR$$
Current and voltage are **in phase** ($\phi = 0$). Ohm's law works for ac with peak or rms values.
:::

:::formula{title="Average power in a resistor"}
$$P = \tfrac12\,i_m^2R = I^2R$$
$$P = \frac{V^2}{R} = VI$$
$P$ = power averaged over a cycle (W). The instantaneous power is $p = i_m^2R\sin^2\omega t$.
:::

:::formula{title="Inductive reactance"}
$$X_L = \omega L = 2\pi\nu L$$
$$i = i_m\sin\left(\omega t - \frac{\pi}{2}\right)$$
$$i_m = \frac{v_m}{X_L}$$
$L$ = self-inductance (H), $X_L$ in ohm (Ω). Current **lags** the voltage by $\pi/2$ (a quarter cycle, $T/4$). For a pure inductor (no resistance in the winding).
:::

:::formula{title="Capacitive reactance"}
$$X_C = \frac{1}{\omega C} = \frac{1}{2\pi\nu C}$$
$$i = i_m\sin\left(\omega t + \frac{\pi}{2}\right)$$
$$i_m = \frac{v_m}{X_C}$$
$C$ = capacitance (F), $X_C$ in ohm (Ω). Current **leads** the voltage by $\pi/2$.
:::

:::formula{title="Average power in pure L or pure C"}
$$P_L = 0$$
$$P_C = 0$$
Averaged over a full cycle. The instantaneous power is not zero: $p_L = -\tfrac12 v_mi_m\sin 2\omega t$ and $p_C = +\tfrac12 v_mi_m\sin 2\omega t$. Energy goes in for a quarter cycle and comes back in the next.
:::

## Series LCR circuit

:::formula{title="Impedance"}
$$Z = \sqrt{R^2 + (X_C - X_L)^2}$$
$Z$ in ohm. The same current flows through R, L and C. For only R and C, put $X_L = 0$; for only R and L, put $X_C = 0$.
:::

:::formula{title="Current amplitude"}
$$i_m = \frac{v_m}{Z}$$
$$I = \frac{V}{Z}$$
:::

:::formula{title="Phase angle (NCERT form)"}
$$\tan\phi = \frac{X_C - X_L}{R}$$
$$\cos\phi = \frac{R}{Z}$$
$X_C > X_L$: $\phi > 0$, circuit is **capacitive**, current **leads**. $X_C < X_L$: $\phi < 0$, **inductive**, current **lags**. Many books write $\tan\phi = (X_L - X_C)/R$ for the angle by which the **voltage** leads; the size is the same, the sign is opposite.
:::

:::formula{title="Voltages across the parts"}
$$v_{Rm} = i_mR$$
$$v_{Lm} = i_mX_L$$
$$v_{Cm} = i_mX_C$$
$$V = \sqrt{V_R^2 + (V_L - V_C)^2}$$
Holds for peak values and for rms values. Voltages must be added with their phases, never as plain numbers: $V_L$ and $V_C$ are opposite, and $V_R$ is at $90^\circ$ to both.
:::

## Resonance

:::formula{title="Resonant frequency"}
$$\omega_0 = \frac{1}{\sqrt{LC}}$$
$$\nu_0 = \frac{1}{2\pi\sqrt{LC}}$$
At $\omega_0$: $X_L = X_C$, $Z = R$ (the least value), $i_m = v_m/R$ (the largest value), $\phi = 0$, $\cos\phi = 1$. Needs **both** L and C in the circuit.
:::

:::formula{title="Quality factor (series LCR)"}
$$Q = \frac{\omega_0L}{R} = \frac{1}{\omega_0CR}$$
No unit. Given in NCERT's table of quantities (the formula only; NCERT does not discuss it further). Exam extra (under "resonance" in the JEE Main and NEET syllabi, not in NCERT): at resonance $V_L = V_C = Q\,V$, so each can be much larger than the source voltage $V$.
:::

## Power in an ac circuit

:::formula{title="Instantaneous power"}
$$p = vi$$
$$\begin{aligned} p &= \tfrac12 v_mi_m\cos\phi \\ &\quad - \tfrac12 v_mi_m\cos(2\omega t + \phi) \end{aligned}$$
The second term varies at **twice** the source frequency and averages to zero.
:::

:::formula{title="Average power and power factor"}
$$P = VI\cos\phi$$
$$P = I^2Z\cos\phi = I^2R$$
$V$, $I$ are **rms** values. $\cos\phi$ = power factor (no unit), from 0 to 1. Power is used up only in the resistance.
:::

:::formula{title="Power and wattless components of current"}
$$I_p = I\cos\phi$$
$$I_q = I\sin\phi$$
$I_p$ is in phase with $V$ and carries all the power: $P = VI_p$. $I_q$ is at $90^\circ$ to $V$ and gives no power (wattless current).
:::

## Transformer (ideal)

:::formula{title="Voltage ratio"}
$$\frac{V_s}{V_p} = \frac{N_s}{N_p}$$
$N_p$, $N_s$ = turns on the primary and secondary. Assumes all the flux links both coils, small primary resistance and current, and small secondary current.
:::

:::formula{title="Current ratio"}
$$\frac{I_s}{I_p} = \frac{N_p}{N_s}$$
$$V_pI_p = V_sI_s$$
Only for a 100% efficient (no loss) transformer. Works for rms or peak values.
:::

:::formula{title="Efficiency"}
$$\eta = \frac{P_{out}}{P_{in}} = \frac{V_sI_s}{V_pI_p}$$
A real transformer has $\eta < 1$; a well-designed one is above 95%.
:::

## Extras beyond the NCERT text

:::formula{title="Average value over half a cycle"}
$$i_{av} = \frac{2i_m}{\pi} \approx 0.637\,i_m$$
Over the positive half cycle only. Over a full cycle the average is **zero**. Beyond the syllabus: not in NCERT and not named in either syllabus; a small aid for questions that ask for the "average value".
:::

:::formula{title="rms of any current"}
$$I_{rms} = \sqrt{\langle i^2\rangle}$$
For $i = I_1 + I_0\sin\omega t$:
$$I_{rms} = \sqrt{I_1^2 + \tfrac12 I_0^2}$$
The definition $I = \sqrt{\langle i^2\rangle}$ is NCERT's (Eq. 7.6). Using it for a dc + ac current is an exam extra: "RMS value" is in the JEE Main and NEET syllabi, but NCERT works only the pure sine case. Square, average over a cycle, then take the root.
:::

:::formula{title="Bandwidth and sharpness"}
$$\Delta\omega = \omega_2 - \omega_1 = \frac{R}{L}$$
$$Q = \frac{\omega_0}{\Delta\omega}$$
$\omega_1$, $\omega_2$ = half-power frequencies, where $P = P_{max}/2$ and $Z = \sqrt2\,R$. Larger $Q$ (smaller $R$) means a sharper resonance. Exam extra: under "resonance" in the JEE Main and NEET syllabi; the sharpness section was removed from the current NCERT text.
:::

:::formula{title="LC oscillations"}
$$\omega_0 = \frac{1}{\sqrt{LC}}$$
$$\frac{q_0^2}{2C} = \frac12 L\,i_0^2$$
$$i_0 = \omega_0q_0$$
A charged capacitor joined to an inductor (no R) oscillates at $\omega_0$ (NCERT Exercise 7.6 uses this). $q_0$ = peak charge (C), $i_0$ = peak current (A). The energy equation is beyond the syllabus: the LC oscillation section was removed from NCERT and neither syllabus names it. Kept as a small aid.
:::
