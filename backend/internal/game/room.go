package game

import (
	"math"
	"sort"
	"time"
)

type Room struct {
	id     string
	name   string
	hostID string

	created time.Time

	started bool
	finished     bool
	gameOverSent bool
	winnerID     string
	winScore     int
	showEnemiesOnMap bool
	wallText string
	tick    uint64
	m       Map

	players map[string]*Player
}

type RoomSummary struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Players int    `json:"players"`
	Started bool   `json:"started"`
}

type RoomState struct {
	ID      string        `json:"id"`
	Name    string        `json:"name"`
	HostID  string        `json:"hostId"`
	Started bool          `json:"started"`
	Finished bool         `json:"finished"`
	WinnerID string       `json:"winnerId"`
	WinScore int          `json:"winScore"`
	ShowEnemiesOnMap bool `json:"showEnemiesOnMap"`
	WallText string       `json:"wallText"`
	Players []PlayerState `json:"players"`
}

type GameState struct {
	Tick    uint64        `json:"tick"`
	Players []PlayerFrame `json:"players"`
}

type PlayerState struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Ready bool   `json:"ready"`
}

type PlayerFrame struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Dir   float64 `json:"dir"`
	HP    int     `json:"hp"`
	Score int     `json:"score"`
}

type Player struct {
	id   string
	name string

	ready bool

	x, y     float64
	dir      float64
	hp       int
	score    int
	cooldown int

	input InputReq
}

func NewRoom(id, name, hostID string) *Room {
	return &Room{
		id:      id,
		name:    name,
		hostID:  hostID,
		created: time.Now(),
		m:       DefaultMap(),
		winScore: 10,
		showEnemiesOnMap: true,
		wallText: "",
		players: map[string]*Player{},
	}
}

func (r *Room) Summary() RoomSummary {
	return RoomSummary{
		ID:      r.id,
		Name:    r.name,
		Players: len(r.players),
		Started: r.started,
	}
}

func (r *Room) State() RoomState {
	out := RoomState{
		ID:      r.id,
		Name:    r.name,
		HostID:  r.hostID,
		Started: r.started,
		Finished: r.finished,
		WinnerID: r.winnerID,
		WinScore: r.winScore,
		ShowEnemiesOnMap: r.showEnemiesOnMap,
		WallText: r.wallText,
		Players: make([]PlayerState, 0, len(r.players)),
	}
	for _, p := range r.players {
		out.Players = append(out.Players, PlayerState{ID: p.id, Name: p.name, Ready: p.ready})
	}
	return out
}

func (r *Room) GameState() GameState {
	out := GameState{
		Tick:    r.tick,
		Players: make([]PlayerFrame, 0, len(r.players)),
	}
	for _, p := range r.players {
		out.Players = append(out.Players, PlayerFrame{
			ID:    p.id,
			Name:  p.name,
			X:     p.x,
			Y:     p.y,
			Dir:   p.dir,
			HP:    p.hp,
			Score: p.score,
		})
	}
	return out
}

func (r *Room) Rankings() []PlayerFrame {
	out := make([]PlayerFrame, 0, len(r.players))
	for _, p := range r.players {
		out = append(out, PlayerFrame{
			ID:    p.id,
			Name:  p.name,
			X:     p.x,
			Y:     p.y,
			Dir:   p.dir,
			HP:    p.hp,
			Score: p.score,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].HP > out[j].HP
	})
	return out
}

func (r *Room) AddPlayer(id, name string) {
	if _, ok := r.players[id]; ok {
		return
	}
	spawns := [][2]float64{
		{2.5, 2.5},
		{13.5, 2.5},
		{2.5, 8.5},
		{13.5, 8.5},
	}
	spawn := spawns[len(r.players)%len(spawns)]
	r.players[id] = &Player{
		id:   id,
		name: name,
		x:    spawn[0],
		y:    spawn[1],
		dir:  0,
		hp:   100,
	}
	if r.hostID == "" {
		r.hostID = id
	}
}

func (r *Room) RemovePlayer(id string) {
	delete(r.players, id)
	if r.hostID == id {
		r.hostID = ""
		for pid := range r.players {
			r.hostID = pid
			break
		}
	}
}

func (r *Room) SetReady(id string, ready bool) {
	if p := r.players[id]; p != nil {
		p.ready = ready
	}
}

func (r *Room) AllReady() bool {
	if len(r.players) == 0 {
		return false
	}
	for _, p := range r.players {
		if !p.ready {
			return false
		}
	}
	return true
}

func (r *Room) Start() {
	r.started = true
	r.finished = false
	r.gameOverSent = false
	r.winnerID = ""
	for _, p := range r.players {
		p.ready = false
		p.hp = 100
		p.score = 0
		p.cooldown = 0
	}
}

func (r *Room) ConfigureForStart(winScore *int, showEnemiesOnMap *bool, wallText *string) {
	if winScore != nil {
		ws := *winScore
		if ws <= 0 {
			ws = 10
		}
		if ws > 50 {
			ws = 50
		}
		r.winScore = ws
	}
	if showEnemiesOnMap != nil {
		r.showEnemiesOnMap = *showEnemiesOnMap
	}
	if wallText != nil {
		r.wallText = sanitizeWallText(*wallText)
	}
}

func (r *Room) SetInput(id string, in InputReq) {
	if p := r.players[id]; p != nil {
		p.input = in
		p.dir = normalizeAngle(p.dir + in.Turn)
	}
}

func (r *Room) Tick() {
	r.tick++

	for _, p := range r.players {
		r.stepPlayer(p)
	}
	for _, p := range r.players {
		if p.cooldown > 0 {
			p.cooldown--
		}
		if p.input.Shoot && p.cooldown == 0 {
			p.cooldown = 6
			r.shoot(p)
		}
		p.input.Shoot = false
	}
}

func (r *Room) stepPlayer(p *Player) {
	speed := 0.08
	dx, dy := 0.0, 0.0
	if p.input.Forward {
		dx += math.Cos(p.dir) * speed
		dy += math.Sin(p.dir) * speed
	}
	if p.input.Back {
		dx -= math.Cos(p.dir) * speed
		dy -= math.Sin(p.dir) * speed
	}
	if p.input.Left {
		dx += math.Cos(p.dir-math.Pi/2) * speed
		dy += math.Sin(p.dir-math.Pi/2) * speed
	}
	if p.input.Right {
		dx += math.Cos(p.dir+math.Pi/2) * speed
		dy += math.Sin(p.dir+math.Pi/2) * speed
	}

	radius := 0.18
	nx := p.x + dx
	if !r.m.IsWall(nx+radius, p.y) && !r.m.IsWall(nx-radius, p.y) {
		p.x = nx
	}
	ny := p.y + dy
	if !r.m.IsWall(p.x, ny+radius) && !r.m.IsWall(p.x, ny-radius) {
		p.y = ny
	}
}

func (r *Room) shoot(shooter *Player) {
	maxDist := 12.0
	step := 0.05
	hitRadius := 0.22
	x := shooter.x
	y := shooter.y
	vx := math.Cos(shooter.dir)
	vy := math.Sin(shooter.dir)

	for d := 0.0; d < maxDist; d += step {
		x += vx * step
		y += vy * step
		if r.m.IsWall(x, y) {
			return
		}
		for _, target := range r.players {
			if target.id == shooter.id || target.hp <= 0 {
				continue
			}
			if (target.x-x)*(target.x-x)+(target.y-y)*(target.y-y) <= hitRadius*hitRadius {
				target.hp -= 35
				if target.hp <= 0 {
					shooter.score++
					if !r.finished && shooter.score >= r.winScore {
						r.finished = true
						r.winnerID = shooter.id
					}
					r.respawn(target)
				}
				return
			}
		}
	}
}

func (r *Room) respawn(p *Player) {
	spawns := [][2]float64{
		{2.5, 2.5},
		{13.5, 2.5},
		{2.5, 8.5},
		{13.5, 8.5},
	}
	spawn := spawns[int(r.tick)%len(spawns)]
	p.x = spawn[0]
	p.y = spawn[1]
	p.hp = 100
	p.dir = 0
}

func normalizeAngle(a float64) float64 {
	for a < -math.Pi {
		a += 2 * math.Pi
	}
	for a > math.Pi {
		a -= 2 * math.Pi
	}
	return a
}
