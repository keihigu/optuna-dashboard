import { useRecoilState } from "recoil"
import { useSnackbar } from "notistack"
import {
  getStudyDetailAPI,
  getStudySummariesAPI,
  createNewStudyAPI,
  deleteStudyAPI,
  saveNoteAPI,
} from "./apiClient"
import { studyDetailsState, studySummariesState } from "./state"

export const actionCreator = () => {
  const { enqueueSnackbar } = useSnackbar()
  const [studySummaries, setStudySummaries] =
    useRecoilState<StudySummary[]>(studySummariesState)
  const [studyDetails, setStudyDetails] =
    useRecoilState<StudyDetails>(studyDetailsState)

  const setStudyDetailState = (studyId: number, study: StudyDetail) => {
    const newVal = Object.assign({}, studyDetails)
    newVal[studyId] = study
    setStudyDetails(newVal)
  }

  const updateStudySummaries = (successMsg?: string) => {
    getStudySummariesAPI()
      .then((studySummaries: StudySummary[]) => {
        setStudySummaries(studySummaries)

        if (successMsg) {
          enqueueSnackbar(successMsg, { variant: "success" })
        }
      })
      .catch((err) => {
        enqueueSnackbar(`Failed to fetch study list.`, {
          variant: "error",
        })
        console.log(err)
      })
  }

  const updateStudyDetail = (studyId: number) => {
    let nLocalFixedTrials = 0
    if (studyId in studyDetails) {
      const currentTrials = studyDetails[studyId].trials
      const firstUpdatable = currentTrials.findIndex((trial) =>
        ["Running", "Waiting"].includes(trial.state)
      )
      nLocalFixedTrials =
        firstUpdatable === -1 ? currentTrials.length : firstUpdatable
    }
    getStudyDetailAPI(studyId, nLocalFixedTrials)
      .then((study) => {
        const currentFixedTrials =
          studyId in studyDetails
            ? studyDetails[studyId].trials.slice(0, nLocalFixedTrials)
            : []
        study.trials = currentFixedTrials.concat(study.trials)
        study.objective_names = study.directions.map((v, i) => `${i}`)
        //console.log(study.directions, study.objective_names)
        const localStorageIDName = `savedObjectiveName_${studyId}`
        const localStorageObjectiveIDs =
          localStorage.getItem(localStorageIDName)
        if (localStorageObjectiveIDs !== null) {
          const names = { ...JSON.parse(localStorageObjectiveIDs) }
          if (Object.keys(names).length > 0) {
            study.objective_names = Object.keys(names).map((k, i) => names[i])
          }
        }

        setStudyDetailState(studyId, study)
      })
      .catch((err) => {
        const reason = err.response?.data.reason
        if (reason !== undefined) {
          enqueueSnackbar(`Failed to fetch study (reason=${reason})`, {
            variant: "error",
          })
        }
        console.log(err)
      })
  }

  const createNewStudy = (studyName: string, directions: StudyDirection[]) => {
    createNewStudyAPI(studyName, directions)
      .then((study_summary) => {
        const newVal = [...studySummaries, study_summary]
        setStudySummaries(newVal)
        enqueueSnackbar(`Success to create a study (study_name=${studyName})`, {
          variant: "success",
        })
      })
      .catch((err) => {
        enqueueSnackbar(`Failed to create a study (study_name=${studyName})`, {
          variant: "error",
        })
        console.log(err)
      })
  }

  const deleteStudy = (studyId: number) => {
    deleteStudyAPI(studyId)
      .then((study) => {
        setStudySummaries(studySummaries.filter((s) => s.study_id !== studyId))
        enqueueSnackbar(`Success to delete a study (id=${studyId})`, {
          variant: "success",
        })
      })
      .catch((err) => {
        enqueueSnackbar(`Failed to delete study (id=${studyId})`, {
          variant: "error",
        })
        console.log(err)
      })
  }

  const setObjectiveNames = (studyId: number, objectiveNames: string[]) => {
    // 1. localStorageにobjective_namesをセットします
    // TODO: ここでlocalStorageを更新する
    const localStorageIDName = `savedObjectiveName_${studyId}`
    localStorage.setItem(localStorageIDName, JSON.stringify(objectiveNames))

    // 2. studyDetailState.objective_namesにobjective_namesをセットします
    const newVal = Object.assign({}, studyDetails)
    newVal[studyId] = { ...newVal[studyId], objective_names: objectiveNames }
    setStudyDetails(newVal)
  }

  const saveNote = (studyId: number, note: Note): Promise<void> => {
    return saveNoteAPI(studyId, note)
      .then(() => {
        const newStudy = Object.assign({}, studyDetails[studyId])
        newStudy.note = note
        setStudyDetailState(studyId, newStudy)
        enqueueSnackbar(`Success to save the note`, {
          variant: "success",
        })
      })
      .catch((err) => {
        if (err.response.status === 409) {
          const newStudy = Object.assign({}, studyDetails[studyId])
          newStudy.note = err.response.data.note
          setStudyDetailState(studyId, newStudy)
        }
        const reason = err.response?.data.reason
        if (reason !== undefined) {
          enqueueSnackbar(`Failed: ${reason}`, {
            variant: "error",
          })
        }
        throw err
      })
  }

  return {
    updateStudyDetail,
    updateStudySummaries,
    createNewStudy,
    deleteStudy,
    saveNote,
    setObjectiveNames,
  }
}

export type Action = ReturnType<typeof actionCreator>
