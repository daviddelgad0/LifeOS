import type { Exercise } from "./types";

// 71 pre-loaded exercises. ids are stable — workout history references them.
export const EXERCISES: Exercise[] = [
  // Chest (9)
  { id: "bench-press", name: "Barbell bench press", muscle: "chest", secondary: ["triceps", "shoulders"], equipment: "barbell", difficulty: "intermediate", instructions: "Lie on the bench, grip just outside shoulder width, lower the bar to mid-chest and press back up.", tip: "Keep your shoulder blades pinned together and feet planted." },
  { id: "incline-bench", name: "Incline barbell press", muscle: "chest", secondary: ["shoulders", "triceps"], equipment: "barbell", difficulty: "intermediate", instructions: "On a 30° incline bench, lower the bar to your upper chest and press up.", tip: "Don't let the bar drift toward your neck." },
  { id: "db-bench", name: "Dumbbell bench press", muscle: "chest", secondary: ["triceps", "shoulders"], equipment: "dumbbell", difficulty: "beginner", instructions: "Press dumbbells from chest level to lockout, palms forward.", tip: "Lower until you feel a stretch — deeper range than a barbell allows." },
  { id: "incline-db-press", name: "Incline dumbbell press", muscle: "chest", secondary: ["shoulders", "triceps"], equipment: "dumbbell", difficulty: "beginner", instructions: "On an incline bench, press dumbbells up and slightly together.", tip: "Keep elbows about 45° from your torso." },
  { id: "db-fly", name: "Dumbbell fly", muscle: "chest", secondary: [], equipment: "dumbbell", difficulty: "intermediate", instructions: "With a slight elbow bend, open your arms wide and squeeze back together over your chest.", tip: "Think of hugging a barrel — don't turn it into a press." },
  { id: "cable-crossover", name: "Cable crossover", muscle: "chest", secondary: [], equipment: "cable", difficulty: "beginner", instructions: "From high pulleys, bring handles down and together in front of your chest.", tip: "Pause and squeeze for a second at the midpoint." },
  { id: "push-up", name: "Push-up", muscle: "chest", secondary: ["triceps", "core"], equipment: "bodyweight", difficulty: "beginner", instructions: "Hands under shoulders, body in a straight line, lower chest to the floor and press up.", tip: "Squeeze your glutes to keep your hips from sagging." },
  { id: "machine-chest-press", name: "Machine chest press", muscle: "chest", secondary: ["triceps"], equipment: "machine", difficulty: "beginner", instructions: "Adjust the seat so handles sit at mid-chest, press to lockout.", tip: "Control the negative — two seconds down." },
  { id: "pec-deck", name: "Pec deck", muscle: "chest", secondary: [], equipment: "machine", difficulty: "beginner", instructions: "With forearms or hands on the pads, bring the arms together in front of you.", tip: "Set the seat so your elbows match shoulder height." },

  // Back (11)
  { id: "deadlift", name: "Deadlift", muscle: "back", secondary: ["hamstrings", "glutes", "forearms"], equipment: "barbell", difficulty: "advanced", instructions: "Hinge down, grip the bar outside your knees, brace, and stand up by driving through the floor.", tip: "The bar should stay in contact with your legs the whole way." },
  { id: "pull-up", name: "Pull-up", muscle: "back", secondary: ["biceps"], equipment: "bodyweight", difficulty: "intermediate", instructions: "Overhand grip, pull your chin over the bar, lower under control.", tip: "Lead with your chest, not your chin." },
  { id: "chin-up", name: "Chin-up", muscle: "back", secondary: ["biceps"], equipment: "bodyweight", difficulty: "intermediate", instructions: "Underhand grip, pull until your chin clears the bar.", tip: "Full hang at the bottom — no half reps." },
  { id: "lat-pulldown", name: "Lat pulldown", muscle: "back", secondary: ["biceps"], equipment: "cable", difficulty: "beginner", instructions: "Pull the bar to your upper chest while leaning back slightly.", tip: "Drive your elbows down and back, don't pull with your hands." },
  { id: "barbell-row", name: "Barbell row", muscle: "back", secondary: ["biceps", "core"], equipment: "barbell", difficulty: "intermediate", instructions: "Hinge to about 45°, row the bar to your lower ribs.", tip: "If you have to heave with your hips, it's too heavy." },
  { id: "db-row", name: "Dumbbell row", muscle: "back", secondary: ["biceps"], equipment: "dumbbell", difficulty: "beginner", instructions: "One hand on the bench, row the dumbbell to your hip.", tip: "Pull with your elbow, keep your torso square." },
  { id: "cable-row", name: "Seated cable row", muscle: "back", secondary: ["biceps"], equipment: "cable", difficulty: "beginner", instructions: "Sit tall, pull the handle to your stomach, squeeze your shoulder blades.", tip: "Don't rock — your torso stays nearly vertical." },
  { id: "t-bar-row", name: "T-bar row", muscle: "back", secondary: ["biceps"], equipment: "barbell", difficulty: "intermediate", instructions: "Straddle the bar, hinge forward, row the handles to your chest.", tip: "Keep your chest up against the pad if using one." },
  { id: "straight-arm-pulldown", name: "Straight-arm pulldown", muscle: "back", secondary: ["core"], equipment: "cable", difficulty: "beginner", instructions: "Arms nearly straight, pull the bar from eye level down to your thighs.", tip: "Feel it in your lats, not your triceps." },
  { id: "rack-pull", name: "Rack pull", muscle: "back", secondary: ["glutes", "forearms"], equipment: "barbell", difficulty: "intermediate", instructions: "Deadlift from knee-height pins — brace and stand tall.", tip: "Squeeze your glutes hard at lockout, don't lean back." },
  { id: "back-extension", name: "Back extension", muscle: "back", secondary: ["glutes", "hamstrings"], equipment: "bodyweight", difficulty: "beginner", instructions: "Hinge over the pad and raise your torso until your body is straight.", tip: "Don't hyperextend at the top." },

  // Shoulders (9)
  { id: "ohp", name: "Overhead press", muscle: "shoulders", secondary: ["triceps", "core"], equipment: "barbell", difficulty: "intermediate", instructions: "From the front rack, press the bar overhead until your elbows lock.", tip: "Squeeze your glutes so your lower back doesn't arch." },
  { id: "db-shoulder-press", name: "Seated dumbbell press", muscle: "shoulders", secondary: ["triceps"], equipment: "dumbbell", difficulty: "beginner", instructions: "Seated with back support, press dumbbells from ear level to overhead.", tip: "Lower until your elbows hit about 90°." },
  { id: "arnold-press", name: "Arnold press", muscle: "shoulders", secondary: ["triceps"], equipment: "dumbbell", difficulty: "intermediate", instructions: "Start palms facing you, rotate out as you press overhead.", tip: "Keep the rotation smooth — no jerking." },
  { id: "lateral-raise", name: "Lateral raise", muscle: "shoulders", secondary: [], equipment: "dumbbell", difficulty: "beginner", instructions: "Raise dumbbells out to your sides to shoulder height.", tip: "Lead with your elbows; tilt the pinky slightly up." },
  { id: "cable-lateral-raise", name: "Cable lateral raise", muscle: "shoulders", secondary: [], equipment: "cable", difficulty: "beginner", instructions: "With the cable behind your body, raise your arm out to the side.", tip: "Constant tension — don't rest at the bottom." },
  { id: "front-raise", name: "Front raise", muscle: "shoulders", secondary: [], equipment: "dumbbell", difficulty: "beginner", instructions: "Raise the dumbbell in front of you to shoulder height.", tip: "No swinging — strict and controlled." },
  { id: "rear-delt-fly", name: "Rear delt fly", muscle: "shoulders", secondary: ["back"], equipment: "dumbbell", difficulty: "beginner", instructions: "Hinged forward, open your arms out wide behind you.", tip: "Think about pulling the dumbbells apart, not lifting them." },
  { id: "face-pull", name: "Face pull", muscle: "shoulders", secondary: ["back"], equipment: "cable", difficulty: "beginner", instructions: "Pull the rope toward your face, ending with hands beside your ears.", tip: "External rotation at the end is the whole point." },
  { id: "upright-row", name: "Upright row", muscle: "shoulders", secondary: ["biceps"], equipment: "barbell", difficulty: "intermediate", instructions: "Pull the bar up your body to chest height, elbows leading.", tip: "Stop at chest height — higher can pinch the shoulder." },

  // Biceps (6)
  { id: "barbell-curl", name: "Barbell curl", muscle: "biceps", secondary: ["forearms"], equipment: "barbell", difficulty: "beginner", instructions: "Curl the bar from your thighs to shoulder height without swinging.", tip: "Pin your elbows to your sides." },
  { id: "db-curl", name: "Dumbbell curl", muscle: "biceps", secondary: ["forearms"], equipment: "dumbbell", difficulty: "beginner", instructions: "Curl with palms up, one or both arms.", tip: "Full extension at the bottom of every rep." },
  { id: "hammer-curl", name: "Hammer curl", muscle: "biceps", secondary: ["forearms"], equipment: "dumbbell", difficulty: "beginner", instructions: "Curl with palms facing each other.", tip: "Hits the brachialis — great for arm thickness." },
  { id: "incline-db-curl", name: "Incline dumbbell curl", muscle: "biceps", secondary: [], equipment: "dumbbell", difficulty: "intermediate", instructions: "Seated on an incline bench, let your arms hang back and curl.", tip: "The stretch at the bottom is where the value is." },
  { id: "preacher-curl", name: "Preacher curl", muscle: "biceps", secondary: [], equipment: "barbell", difficulty: "beginner", instructions: "With arms on the preacher pad, curl the bar up.", tip: "Don't fully lock out at the bottom under heavy load." },
  { id: "cable-curl", name: "Cable curl", muscle: "biceps", secondary: ["forearms"], equipment: "cable", difficulty: "beginner", instructions: "Curl the bar from a low pulley.", tip: "Constant tension — squeeze hard at the top." },

  // Triceps (6)
  { id: "close-grip-bench", name: "Close-grip bench press", muscle: "triceps", secondary: ["chest", "shoulders"], equipment: "barbell", difficulty: "intermediate", instructions: "Bench press with hands shoulder-width, elbows tucked.", tip: "Touch lower on your chest than a normal bench." },
  { id: "skull-crusher", name: "Skull crusher", muscle: "triceps", secondary: [], equipment: "barbell", difficulty: "intermediate", instructions: "Lying down, lower the bar to your forehead by bending the elbows, then extend.", tip: "Let the bar drift slightly behind your head to keep tension." },
  { id: "pushdown", name: "Cable pushdown", muscle: "triceps", secondary: [], equipment: "cable", difficulty: "beginner", instructions: "Elbows pinned, push the bar or rope down to lockout.", tip: "If your elbows flare forward, drop the weight." },
  { id: "overhead-extension", name: "Overhead cable extension", muscle: "triceps", secondary: [], equipment: "cable", difficulty: "beginner", instructions: "Facing away from the pulley, extend your arms overhead.", tip: "The long head only gets stretched overhead — don't skip this." },
  { id: "dip", name: "Dip", muscle: "triceps", secondary: ["chest", "shoulders"], equipment: "bodyweight", difficulty: "intermediate", instructions: "On parallel bars, lower until your upper arms are parallel, press up.", tip: "Stay upright for triceps, lean forward for chest." },
  { id: "diamond-push-up", name: "Diamond push-up", muscle: "triceps", secondary: ["chest"], equipment: "bodyweight", difficulty: "intermediate", instructions: "Push-up with hands together under your chest forming a diamond.", tip: "Keep your elbows tracking back, not out." },

  // Forearms (2)
  { id: "wrist-curl", name: "Wrist curl", muscle: "forearms", secondary: [], equipment: "dumbbell", difficulty: "beginner", instructions: "Forearms on your thighs, curl the weight with just your wrists.", tip: "High reps work best — 15 to 20." },
  { id: "farmers-carry", name: "Farmer's carry", muscle: "forearms", secondary: ["core", "full body"], equipment: "dumbbell", difficulty: "beginner", instructions: "Carry heavy dumbbells at your sides for distance or time.", tip: "Walk tall — shoulders back, core braced." },

  // Core (7)
  { id: "plank", name: "Plank", muscle: "core", secondary: [], equipment: "bodyweight", difficulty: "beginner", instructions: "Hold a straight line from head to heels on your forearms.", tip: "Squeeze glutes and abs — don't just hang on your spine." },
  { id: "crunch", name: "Crunch", muscle: "core", secondary: [], equipment: "bodyweight", difficulty: "beginner", instructions: "Curl your shoulder blades off the floor and lower slowly.", tip: "Exhale hard at the top of each rep." },
  { id: "hanging-leg-raise", name: "Hanging leg raise", muscle: "core", secondary: ["forearms"], equipment: "bodyweight", difficulty: "advanced", instructions: "Hanging from a bar, raise your legs to hip height or above.", tip: "Tilt your pelvis up at the top — that's the ab part." },
  { id: "cable-crunch", name: "Cable crunch", muscle: "core", secondary: [], equipment: "cable", difficulty: "beginner", instructions: "Kneeling below a high pulley, crunch your elbows toward your knees.", tip: "Flex your spine — don't just bow at the hips." },
  { id: "russian-twist", name: "Russian twist", muscle: "core", secondary: [], equipment: "bodyweight", difficulty: "beginner", instructions: "Seated and leaned back, rotate your torso side to side.", tip: "Slower is harder and better." },
  { id: "ab-wheel", name: "Ab wheel rollout", muscle: "core", secondary: ["shoulders"], equipment: "bodyweight", difficulty: "advanced", instructions: "From your knees, roll the wheel forward as far as you can control, then pull back.", tip: "If your back arches, shorten the range." },
  { id: "side-plank", name: "Side plank", muscle: "core", secondary: [], equipment: "bodyweight", difficulty: "beginner", instructions: "Hold a straight line on one forearm, hips stacked.", tip: "Push the floor away — don't sink into the shoulder." },

  // Quads (8)
  { id: "squat", name: "Back squat", muscle: "quads", secondary: ["glutes", "core", "hamstrings"], equipment: "barbell", difficulty: "advanced", instructions: "Bar on your upper back, sit down between your hips until your thighs pass parallel, stand up.", tip: "Drive your knees out in line with your toes." },
  { id: "front-squat", name: "Front squat", muscle: "quads", secondary: ["glutes", "core"], equipment: "barbell", difficulty: "advanced", instructions: "Bar racked on your front delts, squat keeping your torso vertical.", tip: "Elbows high the whole rep or the bar rolls forward." },
  { id: "leg-press", name: "Leg press", muscle: "quads", secondary: ["glutes"], equipment: "machine", difficulty: "beginner", instructions: "Lower the sled until your knees near your chest, press back up.", tip: "Don't let your lower back peel off the pad." },
  { id: "hack-squat", name: "Hack squat", muscle: "quads", secondary: ["glutes"], equipment: "machine", difficulty: "intermediate", instructions: "Squat on the angled sled, back flat against the pad.", tip: "Go deep — the machine keeps you safe." },
  { id: "bulgarian-split-squat", name: "Bulgarian split squat", muscle: "quads", secondary: ["glutes"], equipment: "dumbbell", difficulty: "intermediate", instructions: "Rear foot on a bench, lower your back knee toward the floor.", tip: "Slight forward lean shifts it to glutes; upright hits quads." },
  { id: "walking-lunge", name: "Walking lunge", muscle: "quads", secondary: ["glutes", "core"], equipment: "dumbbell", difficulty: "beginner", instructions: "Step forward into a lunge, push through the front heel, repeat.", tip: "Long steps for glutes, short steps for quads." },
  { id: "leg-extension", name: "Leg extension", muscle: "quads", secondary: [], equipment: "machine", difficulty: "beginner", instructions: "Extend your knees against the pad to full lockout.", tip: "Pause one second at the top." },
  { id: "goblet-squat", name: "Goblet squat", muscle: "quads", secondary: ["glutes", "core"], equipment: "dumbbell", difficulty: "beginner", instructions: "Hold a dumbbell at your chest, squat deep between your knees.", tip: "The counterweight makes depth easy — use it." },

  // Hamstrings (5)
  { id: "rdl", name: "Romanian deadlift", muscle: "hamstrings", secondary: ["glutes", "back"], equipment: "barbell", difficulty: "intermediate", instructions: "Soft knees, push your hips back letting the bar slide down your thighs, then drive hips forward.", tip: "It ends where your hamstrings run out of stretch — not at the floor." },
  { id: "lying-leg-curl", name: "Lying leg curl", muscle: "hamstrings", secondary: [], equipment: "machine", difficulty: "beginner", instructions: "Face down, curl the pad to your glutes.", tip: "Keep your hips pressed into the bench." },
  { id: "seated-leg-curl", name: "Seated leg curl", muscle: "hamstrings", secondary: [], equipment: "machine", difficulty: "beginner", instructions: "Curl the pad under the seat, squeeze at the bottom.", tip: "Better stretch than lying curls — lean slightly forward." },
  { id: "good-morning", name: "Good morning", muscle: "hamstrings", secondary: ["back", "glutes"], equipment: "barbell", difficulty: "advanced", instructions: "Bar on your back, hinge forward until your torso nears parallel, stand up.", tip: "Start light. This one punishes ego." },
  { id: "nordic-curl", name: "Nordic curl", muscle: "hamstrings", secondary: [], equipment: "bodyweight", difficulty: "advanced", instructions: "Knees anchored, lower your body forward under control, push back up.", tip: "Use your hands to catch and assist — almost no one does these unassisted." },

  // Glutes (4)
  { id: "hip-thrust", name: "Hip thrust", muscle: "glutes", secondary: ["hamstrings"], equipment: "barbell", difficulty: "intermediate", instructions: "Upper back on a bench, drive the bar up with your hips to full extension.", tip: "Chin tucked, ribs down at the top — no back arching." },
  { id: "glute-bridge", name: "Glute bridge", muscle: "glutes", secondary: ["hamstrings"], equipment: "bodyweight", difficulty: "beginner", instructions: "On your back, knees bent, drive your hips to the ceiling.", tip: "Pause and squeeze for two seconds at the top." },
  { id: "cable-kickback", name: "Cable kickback", muscle: "glutes", secondary: [], equipment: "cable", difficulty: "beginner", instructions: "Ankle strap on, kick your leg back and slightly up.", tip: "Squeeze the glute, don't swing from your back." },
  { id: "sumo-deadlift", name: "Sumo deadlift", muscle: "glutes", secondary: ["hamstrings", "back", "quads"], equipment: "barbell", difficulty: "advanced", instructions: "Wide stance, grip inside your knees, wedge down and stand up.", tip: "Open your knees out over your toes before you pull." },

  // Calves (3)
  { id: "standing-calf-raise", name: "Standing calf raise", muscle: "calves", secondary: [], equipment: "machine", difficulty: "beginner", instructions: "Rise onto your toes as high as possible, lower until you feel a deep stretch.", tip: "Two-second pause at the bottom kills the bounce." },
  { id: "seated-calf-raise", name: "Seated calf raise", muscle: "calves", secondary: [], equipment: "machine", difficulty: "beginner", instructions: "Knees bent under the pad, raise and lower your heels.", tip: "Seated hits the soleus — both versions matter." },
  { id: "donkey-calf-raise", name: "Donkey calf raise", muscle: "calves", secondary: [], equipment: "machine", difficulty: "intermediate", instructions: "Hinged forward, raise your heels with weight over your hips.", tip: "The stretch in this position is the best of any calf lift." },

  // Full body (1)
  { id: "kb-swing", name: "Kettlebell swing", muscle: "full body", secondary: ["glutes", "hamstrings", "core"], equipment: "kettlebell", difficulty: "intermediate", instructions: "Hinge and snap your hips to swing the bell to chest height.", tip: "It's a hip hinge, not a squat — the arms are just hooks." },
];

export function getExercise(
  id: string,
  custom: Exercise[] = []
): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id) ?? custom.find((e) => e.id === id);
}

export function allExercises(custom: Exercise[] = []): Exercise[] {
  return [...custom, ...EXERCISES];
}
