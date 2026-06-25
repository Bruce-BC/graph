
## 4. 스킬 일괄 커스텀하기 (YAML)
GUI나 CLI에서 3300개가 넘는 패스오브엑자일(PoE) 스킬트리를 일일히 수정하기는 어렵습니다.
따라서, 전체 스킬의 `이름(name)`과 `상태(status)`를 YAML 형식으로 외부로 내보내어 한번에 편집할 수 있습니다.

**1. YAML 내보내기 (Export)**
```bash
python3 cli.py export-yaml --file my_skills.yaml
```
위 명령어를 실행하면 `my_skills.yaml` 파일이 생성되며, 내부에는 모든 스킬의 ID와 기본 이름, 상태가 저장됩니다. (파일명을 생략하면 `skills_config.yaml` 로 저장됩니다.)

**2. YAML 수정하기**
생성된 `my_skills.yaml` 파일을 에디터로 열어서 원하는 스킬의 이름과 상태를 수정하세요.
```yaml
skills:
  "Skill_12345":
    name: "새로운 불마법 스킬"
    status: "Completed"
```

**3. YAML 불러오기 (Import)**
```bash
python3 cli.py import-yaml --file my_skills.yaml
```
수정한 내용을 다시 임포트하면 로컬 작업 트리에 즉시 반영됩니다.

**4. 반영 내역 병합하기**
YAML로 수정한 내역들도 동일하게 Git 프로세스를 거칩니다.
```bash
python3 cli.py add .
python3 cli.py commit -m "스킬 이름 및 상태 대량 업데이트"
python3 cli.py push
```
이후 관리자 권한으로 승인(`approve`)하면 메인 트리에 영구적으로 적용됩니다.
