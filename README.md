# Math Tech-Tree Collaborative Wiki (PoE Edition)

본 프로젝트는 Path of Exile(PoE) 패시브 스킬 트리 및 우주 배경 테마의 아름다운 디자인을 갖춘 **수학 테크트리 협업 저작 도구**입니다. 여러 사용자가 웹 GUI 혹은 파이썬 CLI를 통해 노드 생성, 서브노드(체크포인트) 추가, 의존성 연결 작업을 수행하고 **Git 방식의 스테이징 & 로컬 커밋 & PR 제출 및 병합** 워크플로우를 통해 안전하게 지식을 축적할 수 있습니다.

---

## 🛠️ 개발 스택
- **Backend**: FastAPI (Python 3)
- **Frontend**: HTML5, Vanilla CSS, JS (AntV G6 Graph Engine, Marked.js, MathJax)
- **Database**: JSON 기반 단순 데이터베이스 (`math_tree.json` & `contributions.json`)
- **CLI**: Python 3 내장 라이브러리 기반 REST API 클라이언트 (`cli.py`)

---

## 🚀 시작하기

### 1. 의존성 패키지 설치
FastAPI 서버 실행을 위해 필요한 Python 의존성 패키지를 설치합니다.
```bash
pip install fastapi uvicorn pydantic pandas openpyxl python-jose[cryptography]
```

### 2. 서버 실행
FastAPI 백엔드 웹 서버를 실행합니다.
```bash
python3 app.py
```
서버가 시작되면 웹 브라우저에서 `http://localhost:8000` 주소로 접속할 수 있습니다.

---

## 📁 파일 구조
- `app.py`: FastAPI 라우터, 세션 기반 로그인 인증 및 PR 데이터 병합 알고리즘 구현
- `cli.py`: 원격 API 서버와 통신하는 버전 관리 커맨드라인 매니저
- `math_tree.json`: 프로덕션 공식 테크트리 데이터 파일
- `contributions.json`: 기여자들이 올린 풀 리퀘스트(PR) 적재 파일
- `math_tree_draft.json`: CLI 유저용 로컬 작업 초안 파일
- `.git_index.json`: CLI 유저용 스테이징 영역 파일
- `.git_commits.json`: CLI 유저용 로컬 대기 커밋 파일
- `static/`: HTML, CSS, G6 캔버스 렌더링 자바스크립트 소스코드 탑재 폴더

---

## 💡 Git 스타일 버전 관리 협업 흐름 (Workflow)

```
[로컬 수정 (GUI / CLI)] 
       │
       ▼
[스테이징 (git add / add .)] -> 변경 사항 체크 (ADD, MOD, DEL)
       │
       ▼
[로컬 커밋 (git commit -m)] -> 메시지와 함께 로컬 데이터 묶음 생성
       │
       ▼
[제안 푸시 (git push / PR 제출)] -> 원격 contributions.json에 적재
       │
       ▼
[관리자 검토 및 병합 (Admin Merge)] -> 프리뷰 모드로 시각적 차이점 검증 후 main 병합
```

### 1. 기여자 커맨드라인 (CLI Command) 사용법
- **상태 조회**: `python3 cli.py status`
- **노드 생성**: `python3 cli.py create-node --id <ID> --label <과목명> [--importance High|Medium|Low]`
- **체크포인트 생성**: `python3 cli.py add-subnode --parent-id <부모ID> --label <서브노드명>`
- **연결선(선수관계) 추가**: `python3 cli.py connect --source <출발노드ID> --target <도착노드ID>`
- **스테이징**: `python3 cli.py add <노드ID>` 또는 `python3 cli.py add .` (전체 추가)
- **로컬 커밋**: `python3 cli.py commit -m "커밋 설명 작성"`
- **기여 제출 (Push PR)**: `python3 cli.py push --description "제안 설명 작성"`

### 2. 관리자 커맨드라인 (CLI Admin) 사용법
- **대기 중인 제안 조회**: `python3 cli.py proposals`
- **기여 제안 승인 (Merge)**: `python3 cli.py approve <제안ID_prop-xxxx>`
- **기여 제안 반려 (Reject)**: `python3 cli.py reject <제안ID_prop-xxxx>`

---

## ⌨️ 웹 GUI 유용한 단축키
- `[N]`: 캔버스 중앙에 신규 과목 노드 생성
- `[S]`: 선택된 노드에 서브노드 체크포인트 추가
- `[H]`: 우측 하단 서브노드 목록 에디터 숨기기/보이기 토글
- `[Z]`: 궤도에 공전하는 서브노드 위성 시각화 켜기/끄기 토글
- `[1]`, `[2]`, `[3]`: 선택된 노드의 상태를 각각 완료(Completed), 진행중(In Progress), 잠김(Locked)으로 단축 지정
- `[Delete]` / `[Backspace]`: 선택한 노드 삭제 및 연결선 일괄 제거
- `[Ctrl+S]`/`[Cmd+S]`: 공식 DB 즉시 반영 저장 (Admin 역할 로그인 상태 전용)
