---
title: "Alternating Current: Short Notes"
type: short_notes
chapter: c12.physics.alternating-current
order: 2
---

## 1. What alternating current is

- An **alternating voltage** varies like a sine function of time: $v = v_m\sin\omega t$. The current it drives is an **alternating current**.
- A dc current does not change direction. An ac current reverses every half cycle.
- **Why ac is used:** ac voltage can be stepped up or down easily and efficiently with **transformers**, so power can be sent over long distances economically.
- The ac source itself is an ac generator (Chapter 6): a coil turning in a magnetic field gives $\varepsilon = NBA\omega\sin\omega t$.

## 2. AC through a resistor

Applying Kirchhoff's loop rule: $v_m\sin\omega t = iR$, so $i = i_m\sin\omega t$ with $i_m = v_m/R$.

- Current and voltage are **in phase**: they reach zero, maximum and minimum at the same moments.
- The **average current** over a cycle is **zero** (equal positive and negative halves).
- The heating is **not** zero. Joule heating goes as $i^2R$, and $i^2$ is never negative. Average power $P = \tfrac12 i_m^2R$.

**rms values.** To write ac power in the dc form $P = I^2R$, we use the **root mean square** (effective) current:
$$I = \sqrt{\langle i^2\rangle} = \frac{i_m}{\sqrt2}$$
Similarly $V = v_m/\sqrt2$. Then $V = IR$ and $P = VI = I^2R = V^2/R$, exactly as in dc.

:::remember
The rms current is the dc current that would give the **same average power loss** (heating) in a resistor. One ampere rms of ac heats a resistor as much as one ampere of dc. This is how the ac ampere is defined.
:::

:::example{title="Household supply"}
"220 V ac" is an **rms** value. Peak voltage $v_m = \sqrt2 \times 220 \approx 311$ V. A 100 W, 220 V bulb has $R = V^2/P = 484\ \Omega$ and draws $I = P/V \approx 0.45$ A (NCERT Example 7.1). NCERT also uses 240 V in places (peak $\approx 340$ V); use the value the question gives.
:::

## 3. Phasors

A **phasor** is an arrow that rotates anticlockwise about the origin with angular speed $\omega$.

- Its **length** = the peak value ($v_m$ or $i_m$).
- Its **projection on the vertical axis** = the value at that instant ($v_m\sin\omega t$).
- The angle between two phasors = the **phase difference** between the two quantities.
- For a resistor, the $V$ and $I$ phasors point the same way at all times (phase difference zero).

:::remember
Voltage and current are **scalars**, not vectors. Phasors are only a tool: sinusoidal quantities of the same frequency add in the same way as the projections of rotating arrows.
:::

## 4. AC through a pure inductor

Loop rule: $v - L\,\dfrac{di}{dt} = 0$. Integrating gives $i = i_m\sin(\omega t - \pi/2)$.

- $i_m = v_m/X_L$, where the **inductive reactance** $X_L = \omega L$ (unit: ohm).
- $X_L$ is proportional to $L$ and to the frequency. For dc ($\omega = 0$), $X_L = 0$.
- The current **lags** the voltage by $\pi/2$: it reaches its peak a quarter period ($T/4$) later.
- **Average power = 0.** The inductor stores energy in its magnetic field for a quarter cycle and returns it in the next.

## 5. AC through a capacitor

$q = Cv = Cv_m\sin\omega t$, and $i = dq/dt = \omega Cv_m\cos\omega t = i_m\sin(\omega t + \pi/2)$.

- $i_m = v_m/X_C$, where the **capacitive reactance** $X_C = 1/(\omega C)$ (unit: ohm).
- $X_C$ is inversely proportional to $C$ and to the frequency. For dc, $X_C$ is infinite: after charging, no current flows.
- The current **leads** the voltage by $\pi/2$.
- **Average power = 0.** Energy is stored in the electric field and given back.

:::example{title="Lamp and capacitor (NCERT Example 7.3)"}
A lamp in series with a capacitor does **not** glow on dc (the capacitor charges, then the current stops). On ac it glows. Reducing $C$ raises $X_C$, so the lamp becomes **dimmer**.
:::

| Element | Reactance | Current vs voltage | Avg power |
| --- | --- | --- | --- |
| R | $R$ | in phase | $I^2R$ |
| L | $\omega L$ | lags by $90^\circ$ | 0 |
| C | $1/\omega C$ | leads by $90^\circ$ | 0 |

## 6. Series LCR circuit

The **same current** $i = i_m\sin(\omega t + \phi)$ flows through R, L and C. On the phasor diagram (current phasor as reference):

- $V_R$ is **along** $I$;
- $V_L$ is $\pi/2$ **ahead** of $I$;
- $V_C$ is $\pi/2$ **behind** $I$.

$V_L$ and $V_C$ are opposite, so they combine to a phasor of size $|v_{Cm} - v_{Lm}|$. This is at $90^\circ$ to $V_R$, so by Pythagoras:
$$v_m^2 = v_{Rm}^2 + (v_{Cm} - v_{Lm})^2$$
This gives the **impedance**:
$$Z = \sqrt{R^2 + (X_C - X_L)^2}$$
and $i_m = v_m/Z$. The **impedance diagram** is a right triangle with sides $R$ and $(X_C - X_L)$ and hypotenuse $Z$; $\phi$ is the angle between $R$ and $Z$, with $\tan\phi = (X_C - X_L)/R$.

- $X_C > X_L$: **capacitive**, current leads the source voltage.
- $X_C < X_L$: **inductive**, current lags.

:::example{title="Adding voltages (NCERT Example 7.6)"}
200 Ω and 15 μF in series on 220 V, 50 Hz: $X_C \approx 212\ \Omega$, $Z \approx 292\ \Omega$, $I \approx 0.755$ A. $V_R \approx 151$ V and $V_C \approx 160$ V add up to more than 220 V as numbers, but they are $90^\circ$ apart: $\sqrt{V_R^2 + V_C^2} \approx 220$ V.
:::

**Steady state.** The phasor method gives only the **steady-state** solution. Just after switching on there is also a **transient** part, which dies out after some time.

## 7. Resonance

As $\omega$ changes, $X_L$ rises and $X_C$ falls. At one frequency they are equal:
$$\omega_0 = \frac{1}{\sqrt{LC}}$$

- At resonance $Z = R$ (least), the current amplitude $v_m/R$ is the **largest**, and $\phi = 0$.
- $V_L$ and $V_C$ are equal and opposite and cancel; the **whole source voltage appears across R**.
- A smaller $R$ gives a taller current peak. (In NCERT Fig. 7.14, $R = 100\ \Omega$ gives twice the peak current of $R = 200\ \Omega$.)
- Resonance needs **both L and C**. An RL or RC circuit cannot resonate.

**Uses:**
- **Radio/TV tuning:** the aerial picks up many stations. Changing $C$ in the tuning circuit sets $\omega_0$ equal to one station's frequency, so that station's current is the largest.
- **Metal detector (NCERT Example 7.10):** a coil and capacitor are tuned to resonance. Metal passing through the coil changes the impedance, the current changes a lot, and an alarm sounds.

**Sharpness (exam extra: under "resonance" in the JEE Main and NEET syllabi, not in the current NCERT text):** the quality factor $Q = \omega_0L/R$ tells how sharp the peak is. NCERT gives the formula for $Q$ only in its table of quantities at the end of the chapter.

## 8. Power in an ac circuit

$$P = VI\cos\phi$$
$\cos\phi$ is the **power factor**, and $\cos\phi = R/Z$ in a series LCR circuit.

| Circuit | $\phi$ | Power factor |
| --- | --- | --- |
| Pure R | 0 | 1 (most power) |
| Pure L or pure C | $90^\circ$ | 0 (no power) |
| RL, RC, LCR | between | between 0 and 1 |
| LCR at resonance | 0 | 1 |

- Power is used **only in the resistance**: $P = I^2R$.
- **Wattless current:** in a pure L or C circuit, current flows but no average power is used. More generally, the part $I\sin\phi$ (at $90^\circ$ to $V$) is wattless; the part $I\cos\phi$ (in phase with $V$) is the power component.

**Why a low power factor is bad (NCERT Example 7.7):** to supply power $P$ at voltage $V$, the current is $I = P/(V\cos\phi)$. A small $\cos\phi$ needs a large current, and the $I^2R$ loss in the lines goes up.

**Improving it (NCERT Example 7.7):** suppose the current lags the voltage (an inductive circuit). A **capacitor in parallel** draws a leading wattless current that cancels the lagging wattless current. The power factor then moves towards 1.

## 9. Transformer

Changes an ac voltage to a higher or lower value, using **mutual induction**.

- Two coils, insulated from each other, wound on a **soft-iron core**: one over the other, or on separate limbs. **Primary** ($N_p$ turns) = input; **secondary** ($N_s$ turns) = output.
- The alternating primary current makes an alternating flux in the core. This flux links the secondary and induces an emf in it.
- **Ideal transformer:** $V_s/V_p = N_s/N_p$, and with no loss $I_s/I_p = N_p/N_s$.
- **Step-up:** $N_s > N_p$, voltage goes up, current goes down. **Step-down:** $N_s < N_p$, voltage goes down, current goes up.
- The frequency does not change.

| Energy loss | Cause | How it is reduced |
| --- | --- | --- |
| Flux leakage | Not all primary flux links the secondary | Wind the coils one over the other |
| Winding resistance | $I^2R$ heating in the wires | Thick wire for high-current coils |
| Eddy currents | Currents induced in the iron core | Laminated core |
| Hysteresis | Core magnetised back and forth | Core material with low hysteresis loss |

**Power transmission:** the generator voltage is **stepped up** so the line current is small, which cuts the $I^2R$ loss. Near the users it is **stepped down** in stages (sub-stations, then utility poles) to about 240 V.

## 10. LC oscillations (beyond the syllabus)

A charged capacitor connected to an inductor (no resistance) makes charge oscillate at $\omega_0 = 1/\sqrt{LC}$, the same as the resonant frequency. NCERT Exercise 7.6 asks for this frequency. The energy swaps between the capacitor's electric field and the inductor's magnetic field: $\dfrac{q_0^2}{2C} = \tfrac12 Li_0^2$. The full LC oscillation section was removed from the current NCERT book and neither syllabus names it; only the frequency (Exercise 7.6) is needed.
