---
title: "Thermal Properties of Matter: Formula Sheet"
type: formula_sheet
chapter: c11.physics.thermal-properties-of-matter
order: 1
---

Symbols follow NCERT: $\alpha_l$ and $\alpha_V$ for expansion, $s$ for specific heat capacity, $K$ for thermal conductivity, $H$ for rate of heat flow. Many other books write $\alpha$, $\beta$, $\gamma$ for linear, area and volume expansion.

## Temperature scales

:::formula{title="Celsius and Fahrenheit"}
$$\frac{t_F - 32}{180} = \frac{t_C}{100}$$
$$t_F = \frac{9}{5}\,t_C + 32$$
Ice point 0 °C = 32 °F, steam point 100 °C = 212 °F. A **change** of 1 °C = a change of 1.8 °F.
:::

:::formula{title="Kelvin and Celsius"}
$$T = t_C + 273.15$$
$T$ in kelvin (K). One kelvin is the same size as one degree Celsius, so a temperature **difference** is the same number in K and in °C.
:::

:::formula{title="Any scale with two fixed points (exam extra)"}
$$\frac{X - X_{ice}}{X_{steam} - X_{ice}} = \frac{t_C}{100}$$
$X$ = reading on the other scale (or of a faulty thermometer). The fraction is the same on every linear scale.
:::

:::formula{title="Constant-volume gas thermometer"}
$$T = 273.16\ \text{K} \times \frac{P}{P_{tr}}$$
$P_{tr}$ = gas pressure at the triple point of water, with the volume kept fixed. Exact only in the low-density (ideal-gas) limit. NCERT uses it in the exercises, not in the main text.
:::

## Ideal-gas equation

:::formula{title="Ideal-gas equation"}
$$PV = \mu RT$$
$\mu$ = number of moles, $R = 8.31$ J mol⁻¹ K⁻¹, $T$ in kelvin. Holds for low-density gases. Combines Boyle's law ($PV$ constant at fixed $T$) and Charles' law ($V/T$ constant at fixed $P$).
:::

## Thermal expansion

:::formula{title="Linear expansion"}
$$\frac{\Delta l}{l} = \alpha_l\,\Delta T$$
$$l_2 = l_1\,(1 + \alpha_l\,\Delta T)$$
$\alpha_l$ in K⁻¹ (metals about $10^{-5}$ K⁻¹). Valid for a **small** $\Delta T$, where $\alpha_l$ is roughly constant.
:::

:::formula{title="Area and volume expansion"}
$$\frac{\Delta A}{A} = 2\alpha_l\,\Delta T$$
$$\frac{\Delta V}{V} = \alpha_V\,\Delta T$$
$$\alpha_V = 3\alpha_l$$
For a solid that expands equally in all directions. The squares of $\alpha_l\Delta T$ are neglected because they are tiny.
:::

:::formula{title="Ideal gas at constant pressure"}
$$\alpha_V = \frac{1}{T}$$
$T$ in kelvin. At 0 °C, $\alpha_V = 3.7 \times 10^{-3}$ K⁻¹, much larger than for solids and liquids.
:::

:::formula{title="Change in density (exam extra)"}
$$\rho_2 = \frac{\rho_1}{1 + \alpha_V\,\Delta T}$$
$$\rho_2 \approx \rho_1\,(1 - \alpha_V\,\Delta T)$$
Mass stays the same, volume grows, so density falls. Fractional change $\Delta\rho/\rho \approx -\alpha_V\Delta T$.
:::

:::formula{title="Thermal stress (rod fixed at both ends)"}
$$\frac{F}{A} = Y\,\alpha_l\,\Delta T$$
$$F = Y A\,\alpha_l\,\Delta T$$
$Y$ = Young's modulus (N m⁻²), $A$ = area of cross-section. It does **not** depend on the length of the rod.
:::

:::formula{title="Liquid in a vessel (exam extra)"}
$$\alpha_{apparent} = \alpha_{V,liquid} - \alpha_{V,vessel}$$
The vessel expands too, so the liquid seems to expand less than it really does.
:::

:::formula{title="Pendulum clock (exam extra)"}
$$\frac{\Delta t_p}{t_p} = \frac12\,\alpha_l\,\Delta T$$
$t_p$ = period ($t_p \propto \sqrt{l}$). Time lost per day $= \tfrac12\alpha_l\Delta T \times 86400$ s. A clock runs **slow** when it gets hotter.
:::

## Heat capacity and calorimetry

:::formula{title="Heat capacity and specific heat capacity"}
$$S = \frac{\Delta Q}{\Delta T}$$
$$s = \frac{1}{m}\,\frac{\Delta Q}{\Delta T}$$
$$Q = m\,s\,\Delta T$$
$S$ in J K⁻¹ (for the whole body). $s$ in J kg⁻¹ K⁻¹ (for the material); water: 4186 J kg⁻¹ K⁻¹. Use $Q = ms\Delta T$ only when there is **no change of state**.
:::

:::formula{title="Molar specific heat capacity"}
$$C = \frac{1}{\mu}\,\frac{\Delta Q}{\Delta T}$$
Unit J mol⁻¹ K⁻¹. For gases: $C_p$ (constant pressure) and $C_v$ (constant volume), with $C_p > C_v$. For an ideal gas, $C_p - C_v = R$ (shown in Chapter 11).
:::

:::formula{title="Calorie and water equivalent (exam extra)"}
$$1\ \text{cal} = 4.186\ \text{J}$$
$$w = \frac{m\,s}{s_{water}}$$
$w$ = water equivalent (kg): the mass of water with the same heat capacity as the body (a calorimeter, say). Exams often take 1 cal ≈ 4.2 J. The main NCERT text uses only joules.
:::

:::formula{title="Principle of calorimetry"}
$$\text{heat lost} = \text{heat gained}$$
Only for an **isolated** system (no heat lost to the surroundings).
:::

:::formula{title="Final temperature of a mixture"}
$$T_f = \frac{m_1s_1T_1 + m_2s_2T_2}{m_1s_1 + m_2s_2}$$
Only if **neither** body changes state and no heat is lost to the surroundings. With ice, first check whether all of it can melt.
:::

## Change of state

:::formula{title="Latent heat"}
$$Q = m\,L$$
$L$ in J kg⁻¹. The temperature stays **constant** while the state changes. NCERT values for water at 1 atm: $L_f = 3.33 \times 10^5$ J kg⁻¹, $L_v = 22.6 \times 10^5$ J kg⁻¹. (Questions often use $3.34$ or $3.36 \times 10^5$ and $2.26 \times 10^6$ J kg⁻¹; use the value given.)
:::

## Conduction

:::formula{title="Rate of heat flow (heat current)"}
$$H = KA\,\frac{T_C - T_D}{L}$$
$K$ = thermal conductivity (W m⁻¹ K⁻¹ = J s⁻¹ m⁻¹ K⁻¹), $A$ = area, $L$ = length, $T_C > T_D$. Needs the **steady state** and insulated sides. Then the temperature falls linearly along the rod.
:::

:::formula{title="Two rods in series (NCERT example)"}
Same $A$ and same $L$, outer ends at $T_1$ and $T_2$:
$$T_0 = \frac{K_1T_1 + K_2T_2}{K_1 + K_2}$$
$$K' = \frac{2K_1K_2}{K_1 + K_2}$$
$T_0$ = junction temperature, $K'$ = equivalent conductivity of the bar of length $2L$. For other cases, equate $H$ in the two rods.
:::

:::formula{title="Thermal resistance (exam extra)"}
$$R_{th} = \frac{L}{KA}$$
$$H = \frac{\Delta T}{R_{th}}$$
$R_{th}$ in K W⁻¹. Series: $R = R_1 + R_2$ (same $H$ in each). Parallel: $\dfrac{1}{R} = \dfrac{1}{R_1} + \dfrac{1}{R_2}$ (same $\Delta T$ across each). Same rules as electric resistors.
:::

## Radiation

:::formula{title="Wien's displacement law"}
$$\lambda_m T = b$$
$b = 2.9 \times 10^{-3}$ m K. $\lambda_m$ = wavelength of **maximum** energy. Hotter body, shorter $\lambda_m$.
:::

:::formula{title="Stefan–Boltzmann law"}
$$H = A\sigma T^4$$
$$H = Ae\sigma T^4$$
$\sigma = 5.67 \times 10^{-8}$ W m⁻² K⁻⁴, $T$ in **kelvin**. First line: perfect radiator (blackbody, $e = 1$). Second line: emissivity $e$ (between 0 and 1, no unit).
:::

:::formula{title="Net loss to surroundings"}
$$H = e\sigma A\,(T^4 - T_s^4)$$
$T_s$ = temperature of the surroundings. The body emits at $T$ and absorbs at $T_s$.
:::

## Newton's law of cooling

:::formula{title="Rate of loss of heat"}
$$-\frac{dQ}{dt} = k\,(T_2 - T_1)$$
$T_2$ = body, $T_1$ = surroundings (either K or °C, since only the difference appears). $k$ (W K⁻¹) is a positive constant that depends on the area and nature of the surface. Holds only for a **small** temperature difference between the body and its surroundings.
:::

:::formula{title="Rate of cooling"}
$$\frac{dT_2}{dt} = -K\,(T_2 - T_1)$$
$$K = \frac{k}{ms}$$
$m$ = mass, $s$ = specific heat capacity of the body, $K$ in s⁻¹. Same condition: small temperature difference.
:::

:::formula{title="Integrated form"}
$$\ln(T_2 - T_1) = -Kt + c$$
$$T_2 = T_1 + C'e^{-Kt}$$
$C'$ = the excess temperature at $t = 0$. A graph of $\ln(T_2 - T_1)$ against $t$ is a straight line with slope $-K$.
:::

:::formula{title="Average-temperature method (NCERT Example 10.8)"}
$$\frac{\theta_i - \theta_f}{t} = K\,(\bar\theta - T_1)$$
$$\bar\theta = \frac{\theta_i + \theta_f}{2}$$
$\theta_i$, $\theta_f$ = start and end temperatures of one cooling step, $t$ = time it takes. An approximation, good when the step is small.
:::
