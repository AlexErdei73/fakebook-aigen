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

  const isFriendsListPage = useSelector(
    (state) => state.accountPage.isFriendsListPage
  );

  useEffect(() => {
    const { pathname } = location;

    /* friends list page */

    dispatch(
      friendsListPageSet(
        pathname.startsWith("/friends/list") || isFriendsListPage
      )
    );

    /* watch page (videos feed) */

    dispatch(watchSet(pathname.startsWith("/watch")));
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

  const isFriendsListPage = useSelector(
    (state) => state.accountPage.isFriendsListPage
  );

  /* -------------------------------------------------- */

  /*           Firestore-like subscriptions             */

  /* -------------------------------------------------- */

  useEffect(() => {
    const unsubCurrentUser = subscribeCurrentUser();

    const unsubUsers = subscribeUsers();

    const unsubPosts = subscribePosts();

    /* mark user online */

    currentUserOnline();

    /* cleanup */

    return () => {
      unsubCurrentUser();

      unsubUsers();

      unsubPosts();
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
        <Router basename='/fakebook-aigen'>
          <RouteStateSync />

          <TitleBar />

          <Switch>
            {/* Friends list ------------------------------------------------ */}

            <Route path='/friends/list' component={FriendsListPage} />

            {/* Single photo ----------------------------------------------- */}

            <Route path='/photo/:userID/:n' component={PhotoViewer} />

            {/* Watch (video feed) ----------------------------------------- */}

            <Route
              path='/watch'
              render={(props) => <HomePage {...props} className='pt-5' />}
            />

            {/* User profile ----------------------------------------------- */}

            <Route
              path='/:userName'
              component={isFriendsListPage ? FriendsListPage : Profile}
            />

            {/* News-feed root --------------------------------------------- */}

            <Route
              path='/'
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
