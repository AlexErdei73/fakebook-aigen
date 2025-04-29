import React, { useEffect } from "react";

/* UI */

import TitleBar from "./Titlebar";

import Profile from "./Profile";

import PhotoViewer from "./PhotoViewer";

import HomePage from "./HomePage";

import FriendsListPage from "./FriendsListPage";

/* Router */

import {
  BrowserRouter as Router,
  Switch,
  Route,
  useLocation,
} from "react-router-dom";

/* Layout */

import Container from "react-bootstrap/Container";

/* Redux */

import { useDispatch, useSelector } from "react-redux";

import {
  friendsListPageSet,
  profileLinkSet,
  watchSet,
} from "../features/accountPage/accountPageSlice";

/* Mock-backend helpers */

import {
  currentUserOffline,
  currentUserOnline,
  subscribeCurrentUser,
  subscribeUsers,
  subscribePosts,
} from "../backend/backend";

/* ------------------------------------------------------------------ */

/* Keep Redux in sync with the current pathname (once per navigation) */

/* ------------------------------------------------------------------ */

const RouteStateSync = () => {
  const dispatch = useDispatch();

  const location = useLocation();

  useEffect(() => {
    const { pathname } = location;

    /* friends list page */

    dispatch(friendsListPageSet(pathname.startsWith("/fakebook/friends/list")));

    /* watch page (videos feed) */

    dispatch(watchSet(pathname.startsWith("/fakebook/watch")));
  }, [location, dispatch]);

  return null; // renders nothing
};

/* ------------------------------------------------------------------ */

const UserAccount = () => {
  const dispatch = useDispatch();

  /* Redux selectors */

  const profileLink = useSelector((state) => state.accountPage.profileLink);

  const currentUser = useSelector((state) => state.currentUser);

  const users = useSelector((state) => state.users);

  /* -------------------------------------------------- */

  /* Firestore-like subscriptions & online/offline flag */

  /* -------------------------------------------------- */

  useEffect(() => {
    const unsubCurrentUser = subscribeCurrentUser();

    const unsubUsers = subscribeUsers();

    const unsubPosts = subscribePosts();

    /* mark user online */

    currentUserOnline();

    /* window closed or refreshed */

    const beforeUnload = () => currentUserOffline();

    window.addEventListener("beforeunload", beforeUnload);

    /* tab visibility switch */

    const visChange = () =>
      document.visibilityState === "visible"
        ? currentUserOnline()
        : currentUserOffline();

    document.addEventListener("visibilitychange", visChange);

    /* cleanup */

    return () => {
      unsubCurrentUser();

      unsubUsers();

      unsubPosts();

      window.removeEventListener("beforeunload", beforeUnload);

      document.removeEventListener("visibilitychange", visChange);
    };
  }, []);

  /* -------------------------------------------------- */

  /* Build unique profile link (.index appended once)   */

  /* -------------------------------------------------- */

  useEffect(() => {
    if (!currentUser) return;

    /* remove any existing trailing ".number" */

    const base = profileLink.replace(/\.\d+$/, "");

    const newLink =
      currentUser.index && currentUser.index > 0
        ? `${base}.${currentUser.index}`
        : base;

    dispatch(profileLinkSet(newLink));
  }, [currentUser, profileLink, dispatch]);

  /* Loading guard */

  if (!currentUser || users.length === 0) {
    return <div>…Loading</div>;
  }

  /* -------------------------------------------------- */

  /* Render                                             */

  /* -------------------------------------------------- */

  return (
    <div className='bg-200 vw-100 main-container overflow-hidden'>
      <Container className='w-100 p-0' fluid>
        <Router>
          <RouteStateSync />

          <TitleBar />

          <Switch>
            {/* Friends list ------------------------------------------------ */}

            <Route path='/fakebook/friends/list' component={FriendsListPage} />

            {/* Single photo ----------------------------------------------- */}

            <Route path='/fakebook/photo/:userID/:n' component={PhotoViewer} />

            {/* Watch (video feed) ----------------------------------------- */}

            <Route
              path='/fakebook/watch'
              render={(props) => <HomePage {...props} className='pt-5' />}
            />

            {/* User profile ----------------------------------------------- */}

            <Route path='/fakebook/:userName' component={Profile} />

            {/* News-feed root --------------------------------------------- */}

            <Route
              path='/fakebook'
              exact
              render={(props) => <HomePage {...props} className='pt-5' />}
            />
          </Switch>
        </Router>
      </Container>
    </div>
  );
};

export default UserAccount;
